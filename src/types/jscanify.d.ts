declare module "jscanify/client" {
  type ScanSource = HTMLImageElement | HTMLCanvasElement;

  export type PaperPoint = { x: number; y: number };

  export type PaperCorners = {
    topLeftCorner: PaperPoint;
    topRightCorner: PaperPoint;
    bottomLeftCorner: PaperPoint;
    bottomRightCorner: PaperPoint;
  };

  export default class Jscanify {
    findPaperContour(img: {
      delete?: () => void;
    }): { data32S?: ArrayLike<number> } | null;
    getCornerPoints(contour: unknown): Partial<PaperCorners>;
    highlightPaper(
      image: ScanSource,
      options?: { color?: string; thickness?: number },
    ): HTMLCanvasElement;
    extractPaper(
      image: ScanSource,
      resultWidth: number,
      resultHeight: number,
      cornerPoints?: PaperCorners,
    ): HTMLCanvasElement | null;
  }
}
