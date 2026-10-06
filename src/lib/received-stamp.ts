import {
  PDFDocument,
  StandardFonts,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

const INK = rgb(0.74, 0.07, 0.12);
const INK_OPACITY = 0.86;
const TILT_DEGREES = -3.5;
const STAMP_MARK = "rcmp-received-stamp";

export const receivedStampDepartment = "INFORMATION TECHNOLOGY DEPARTMENT";

export function receivedStampDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .toUpperCase();
}

type StampDetails = {
  staffName: string;
  receivedOn: string;
  department: string;
};

type StampFonts = { bold: PDFFont; regular: PDFFont; mono: PDFFont };

function spacedWidth(font: PDFFont, text: string, size: number, tracking: number) {
  return font.widthOfTextAtSize(text, size) + tracking * size * Math.max(text.length - 1, 0);
}

function drawCentered(
  page: PDFPage,
  font: PDFFont,
  text: string,
  centerX: number,
  baseline: number,
  size: number,
  maxWidth: number,
  tracking = 0,
) {
  const natural = spacedWidth(font, text, size, tracking);
  const fitted = natural > maxWidth ? size * (maxWidth / natural) : size;
  let x = centerX - spacedWidth(font, text, fitted, tracking) / 2;
  for (const char of text) {
    page.drawText(char, { x, y: baseline, size: fitted, font, color: INK, opacity: INK_OPACITY });
    x += font.widthOfTextAtSize(char, fitted) + tracking * fitted;
  }
}

function drawRule(page: PDFPage, x1: number, x2: number, y: number, thickness: number) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness,
    color: INK,
    opacity: INK_OPACITY,
  });
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function drawWear(page: PDFPage, width: number, height: number, seed: number) {
  const random = seededRandom(seed);
  for (let index = 0; index < 140; index += 1) {
    page.drawCircle({
      x: random() * width,
      y: random() * height,
      size: 0.25 + random() * 0.9,
      color: rgb(1, 1, 1),
      opacity: 0.35 + random() * 0.45,
    });
  }
}

function drawStamp(page: PDFPage, fonts: StampFonts, stamp: StampDetails, seed: number) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const width = Math.min(250, Math.max(176, pageWidth * 0.4));
  const height = width * 0.5;
  const margin = Math.max(18, Math.min(30, pageWidth * 0.045));
  const angle = (TILT_DEGREES * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const originX = margin;
  const originY = margin + Math.max(0, -sin * width);

  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(cos, sin, -sin, cos, originX, originY),
  );

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    borderColor: INK,
    borderWidth: 2.4,
    borderOpacity: INK_OPACITY,
  });
  page.drawRectangle({
    x: 4.5,
    y: 4.5,
    width: width - 9,
    height: height - 9,
    borderColor: INK,
    borderWidth: 0.8,
    borderOpacity: INK_OPACITY,
  });

  const centerX = width / 2;
  const inner = width - 22;
  const ruleLeft = 14;
  const ruleRight = width - 14;
  const line = (ratio: number) => height * (1 - ratio);

  drawCentered(page, fonts.bold, "UNIVERSITI KUALA LUMPUR", centerX, line(0.19), height * 0.105, inner, 0.04);
  drawCentered(
    page,
    fonts.regular,
    "ROYAL COLLEGE OF MEDICINE PERAK",
    centerX,
    line(0.29),
    height * 0.072,
    inner,
    0.03,
  );
  drawRule(page, ruleLeft, ruleRight, line(0.345), 0.7);

  drawCentered(page, fonts.bold, "RECEIVED", centerX, line(0.5), height * 0.135, inner, 0.18);

  const bandWidth = width * 0.56;
  const bandHeight = height * 0.15;
  const bandBottom = line(0.69);
  page.drawRectangle({
    x: centerX - bandWidth / 2,
    y: bandBottom,
    width: bandWidth,
    height: bandHeight,
    borderColor: INK,
    borderWidth: 0.9,
    borderOpacity: INK_OPACITY,
  });
  drawCentered(
    page,
    fonts.mono,
    stamp.receivedOn,
    centerX,
    bandBottom + bandHeight * 0.26,
    bandHeight * 0.68,
    bandWidth - 8,
    0.06,
  );

  drawRule(page, ruleLeft, ruleRight, line(0.745), 0.7);
  drawCentered(page, fonts.regular, stamp.staffName, centerX, line(0.83), height * 0.075, inner, 0.03);
  drawCentered(page, fonts.bold, stamp.department, centerX, line(0.925), height * 0.07, inner, 0.02);

  drawWear(page, width, height, seed);
  page.pushOperators(popGraphicsState());
}

export async function stampReceivedPdf(
  input: Uint8Array<ArrayBuffer>,
  stamp: StampDetails,
): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = Uint8Array.from(input);
  const doc = await PDFDocument.load(bytes);
  if (doc.getSubject() === STAMP_MARK) return bytes;
  const fonts: StampFonts = {
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    regular: await doc.embedFont(StandardFonts.Helvetica),
    mono: await doc.embedFont(StandardFonts.CourierBold),
  };
  const details = {
    staffName: stamp.staffName.trim().toUpperCase(),
    receivedOn: stamp.receivedOn.trim().toUpperCase(),
    department: stamp.department.trim().toUpperCase(),
  };
  doc.getPages().forEach((page, index) => drawStamp(page, fonts, details, 7919 * (index + 1)));
  doc.setSubject(STAMP_MARK);
  return Uint8Array.from(await doc.save());
}
