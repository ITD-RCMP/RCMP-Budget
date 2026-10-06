import type Jscanify from "jscanify/client";
import type { PaperCorners, PaperPoint } from "jscanify/client";

export type { PaperCorners };

type OpenCvApi = {
  Mat?: unknown;
  imread: (source: HTMLCanvasElement) => { delete: () => void };
  onRuntimeInitialized?: () => void;
};

const OPENCV_URL = "https://docs.opencv.org/4.7.0/opencv.js";

declare global {
  interface Window {
    cv?: OpenCvApi | Promise<OpenCvApi>;
  }
}

let scannerPromise: Promise<Jscanify> | null = null;

function injectOpenCv() {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = OPENCV_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("opencv-load-failed"));
    document.head.appendChild(script);
  });
}

async function waitForOpenCv() {
  if (!window.cv) await injectOpenCv();
  const cv = window.cv instanceof Promise ? await window.cv : window.cv;
  if (!cv) throw new Error("opencv-load-failed");
  if (!cv.Mat) {
    await new Promise<void>((resolve) => {
      cv.onRuntimeInitialized = resolve;
    });
  }
  window.cv = cv;
}

function isPoint(value: Partial<PaperPoint> | undefined): value is PaperPoint {
  return !!value && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function distance(a: PaperPoint, b: PaperPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function boxCorners(data: ArrayLike<number>): PaperCorners | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < data.length; index += 2) {
    minX = Math.min(minX, data[index]);
    maxX = Math.max(maxX, data[index]);
    minY = Math.min(minY, data[index + 1]);
    maxY = Math.max(maxY, data[index + 1]);
  }
  if (!Number.isFinite(minX) || maxX - minX < 40 || maxY - minY < 40) return null;
  return {
    topLeftCorner: { x: minX, y: minY },
    topRightCorner: { x: maxX, y: minY },
    bottomLeftCorner: { x: minX, y: maxY },
    bottomRightCorner: { x: maxX, y: maxY },
  };
}

export function readPaperCorners(
  scanner: Jscanify,
  frame: HTMLCanvasElement,
): PaperCorners | null {
  const cv = window.cv;
  if (!cv || cv instanceof Promise || !cv.Mat) return null;
  const img = cv.imread(frame);
  try {
    const contour = scanner.findPaperContour(img);
    if (!contour) return null;
    const found = scanner.getCornerPoints(contour);
    if (
      isPoint(found.topLeftCorner) &&
      isPoint(found.topRightCorner) &&
      isPoint(found.bottomLeftCorner) &&
      isPoint(found.bottomRightCorner)
    ) {
      return {
        topLeftCorner: found.topLeftCorner,
        topRightCorner: found.topRightCorner,
        bottomLeftCorner: found.bottomLeftCorner,
        bottomRightCorner: found.bottomRightCorner,
      };
    }
    return contour.data32S ? boxCorners(contour.data32S) : null;
  } finally {
    img.delete();
  }
}

export function paperPixelSize(corners: PaperCorners) {
  const width = Math.max(
    distance(corners.topLeftCorner, corners.topRightCorner),
    distance(corners.bottomLeftCorner, corners.bottomRightCorner),
  );
  const height = Math.max(
    distance(corners.topLeftCorner, corners.bottomLeftCorner),
    distance(corners.topRightCorner, corners.bottomRightCorner),
  );
  const longest = Math.max(width, height, 1);
  const scale = longest > 1600 ? 1600 / longest : longest < 1200 ? 1200 / longest : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function focusOnPaper(
  corners: PaperCorners,
  frameWidth: number,
  frameHeight: number,
) {
  const points = [
    corners.topLeftCorner,
    corners.topRightCorner,
    corners.bottomLeftCorner,
    corners.bottomRightCorner,
  ];
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const boxWidth = Math.max(maxX - minX, 1);
  const boxHeight = Math.max(maxY - minY, 1);
  return {
    originX: ((minX + maxX) / 2 / frameWidth) * 100,
    originY: ((minY + maxY) / 2 / frameHeight) * 100,
    scale: Math.min(frameWidth / boxWidth, frameHeight / boxHeight, 4),
  };
}

export function loadDocumentScanner() {
  scannerPromise ??= Promise.all([
    waitForOpenCv(),
    import("jscanify/client"),
  ])
    .then(([, module]) => new module.default())
    .catch((error: unknown) => {
      scannerPromise = null;
      throw error;
    });
  return scannerPromise;
}
