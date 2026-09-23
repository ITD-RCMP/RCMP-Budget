import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { authMiddleware } from "@backend/core/middleware";

type ItemRow = {
  item_name: string;
  item_description: string;
  item_quantity: number;
  item_price: string | number;
};

type RfqContext = {
  rfqNumber: string;
  rfqDate: string;
  email: string;
  department: string;
  items: ItemRow[];
  logo: Buffer;
};

async function buildRfqPdf(ctx: RfqContext) {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ size: "A4", margin: 30 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolveBuffer) =>
    doc.on("end", () => resolveBuffer(Buffer.concat(chunks))),
  );

  const left = 30;
  const width = doc.page.width - 60;
  const grey = "#d9d9d9";
  const beige = "#f7e8c3";
  let y = 30;

  const box = (x: number, boxY: number, w: number, h: number, fill?: string) => {
    if (fill) {
      doc.save().rect(x, boxY, w, h).fillAndStroke(fill, "#000").restore();
    } else {
      doc.rect(x, boxY, w, h).stroke("#000");
    }
  };

  const write = (
    value: string,
    x: number,
    textY: number,
    w: number,
    opts: {
      bold?: boolean;
      size?: number;
      align?: "left" | "center" | "right";
      italic?: boolean;
      color?: string;
    } = {},
  ) => {
    doc
      .font(opts.bold ? "Helvetica-Bold" : opts.italic ? "Helvetica-Oblique" : "Helvetica")
      .fontSize(opts.size ?? 8)
      .fillColor(opts.color ?? "#000")
      .text(value, x, textY, { width: w, align: opts.align ?? "left" });
  };

  const hairline = (lineY: number, thickness = 1) => {
    doc
      .save()
      .lineWidth(thickness)
      .moveTo(left, lineY)
      .lineTo(left + width, lineY)
      .stroke("#000")
      .restore();
  };

  doc.image(ctx.logo, left + 4, y + 2, { width: 55, height: 55 });

  write("REQUEST FOR QUOTATION", left + 80, y + 8, width - 110, {
    bold: true,
    size: 14,
    align: "center",
  });

  const bannerWidth = 280;
  const bannerX = left + 80 + (width - 110 - bannerWidth) / 2;
  doc
    .save()
    .rect(bannerX, y + 32, bannerWidth, 18)
    .fill("#000")
    .restore();
  write("U N I V E R S I T I   K U A L A   L U M P U R", bannerX, y + 37, bannerWidth, {
    bold: true,
    size: 11,
    align: "center",
    color: "#fff",
  });
  y += 64;

  const half = width / 2;
  const infoRow = (
    leftLabel: string,
    leftValue: string,
    rightLabel: string,
    rightValue: string,
    h = 16,
  ) => {
    box(left, y, half, h, grey);
    box(left + half, y, half, h, grey);
    write(leftLabel, left + 4, y + 4, 100, { bold: true });
    write(":", left + 108, y + 4, 10);
    write(leftValue, left + 120, y + 4, half - 126);
    write(rightLabel, left + half + 4, y + 4, 130, { bold: true });
    write(":", left + half + 138, y + 4, 10);
    write(rightValue, left + half + 150, y + 4, half - 156);
    y += h + 4;
  };

  infoRow("TO", "", "FROM", "");
  infoRow("COMPANY", "", "DATE", "");
  infoRow("PHONE NUMBER", "", "REF", "");
  infoRow("FAX NUMBER", "", "TOTAL NO. OF PAGES\nINCLUDING COVER", "", 24);
  infoRow(
    "RE: QUOTATION\nFOR",
    "",
    "SENDER'S TELEPHONE NUMBER",
    "05-2432635 / EXT 146",
    24,
  );

  box(left + half, y, half, 16, grey);
  write("SENDER'S FAX NUMBER", left + half + 4, y + 4, 130, { bold: true });
  write(":", left + half + 138, y + 4, 10);
  write("05-2432636", left + half + 150, y + 4, half - 156);
  y += 20;

  hairline(y, 2);
  y += 6;
  const marks = [
    "√ URGENT",
    "□ FOR REVIEW",
    "□ PLEASE COMMENT",
    "√ PLEASE REPLY",
    "□ PLEASE RECYCLE",
  ] as const;
  const markWidth = width / marks.length;
  marks.forEach((label, i) => {
    const x = left + markWidth * i;
    write(label, x, y, markWidth - 4, { bold: true, size: 8 });
  });
  y += 14;
  hairline(y, 2);
  y += 10;

  write("Dear Sir / Madam", left, y, width, { size: 9 });
  y += 12;
  write("Kindly, please quote to us for the items as stated below;", left, y, width, {
    size: 9,
  });
  y += 16;

  const itemCols = [30, 285, 40, 40, 70, 70];
  const colX = (index: number) => left + itemCols.slice(0, index).reduce((sum, w) => sum + w, 0);
  const headers = ["NO", "ITEM", "QTY", "UOM", "PRICE (RM) /\nUNIT", "COST (RM)"];
  const headerHeight = 24;
  headers.forEach((header, i) => {
    box(colX(i), y, itemCols[i], headerHeight, i === 1 ? beige : undefined);
    write(header, colX(i) + 2, y + 5, itemCols[i] - 4, {
      bold: true,
      size: 8,
      align: "center",
    });
  });
  y += headerHeight;

  const bodyTop = y;
  const bodyHeight = Math.max(230, ctx.items.length * 40 + 24);
  itemCols.forEach((w, c) => box(colX(c), bodyTop, w, bodyHeight));

  const money = (value: number) =>
    value.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  let itemY = bodyTop + 8;
  let grandTotal = 0;
  ctx.items.forEach((item, i) => {
    const unit = Number(item.item_price);
    const cost = unit * item.item_quantity;
    grandTotal += cost;

    write(String(i + 1), colX(0), itemY, itemCols[0], { align: "center", size: 9 });
    doc.font("Helvetica").fontSize(9);
    const text = item.item_description
      ? `${item.item_name}\n${item.item_description
          .split("\n")
          .map((line) => `* ${line}`)
          .join("\n")}`
      : item.item_name;
    const textHeight = doc.heightOfString(text, { width: itemCols[1] - 12 });
    write(text, colX(1) + 6, itemY, itemCols[1] - 12, { size: 9 });
    write(String(item.item_quantity), colX(2), itemY, itemCols[2], {
      align: "center",
      size: 9,
    });
    write("Unit", colX(3), itemY, itemCols[3], { align: "center", size: 9 });
    write(money(unit), colX(4) + 2, itemY, itemCols[4] - 6, {
      align: "right",
      size: 9,
    });
    write(money(cost), colX(5) + 2, itemY, itemCols[5] - 6, {
      align: "right",
      size: 9,
    });
    itemY += textHeight + 14;
  });

  const totalHeight = 18;
  y = bodyTop + bodyHeight;
  box(left, y, itemCols[0] + itemCols[1], totalHeight);
  write("TOTAL (RM)", left, y + 5, itemCols[0] + itemCols[1], {
    bold: true,
    size: 9,
    align: "center",
  });
  for (let c = 2; c < itemCols.length; c++) {
    box(colX(c), y, itemCols[c], totalHeight);
  }
  write(money(grandTotal), colX(5) + 2, y + 5, itemCols[5] - 6, {
    bold: true,
    size: 9,
    align: "right",
  });
  y += totalHeight + 10;

  write(
    "Please send your quotation By: _________________________. Should you need further clarification please call\nthe under sign below OR email to rosmalina@unikl.edu.my. Your early reply is highly appreciated.",
    left,
    y,
    width,
    { size: 9 },
  );
  y += 32;

  write("Term & Condition:", left, y, half, { size: 9 });
  write("Confirmed & Accepted by :-", left + half + 40, y, half - 40, { size: 9 });
  y += 14;
  const terms = [
    "1. Payment Term: 30 days after receiving the invoice",
    "2. Delivery / Completion period:",
    "3. Warranty:",
  ];
  terms.forEach((term) => {
    write(term, left + 8, y, half, { size: 9 });
    y += 13;
  });

  y += 12;
  write("----------------------------------------------", left + half + 40, y, half - 40, {
    size: 9,
  });
  y += 12;
  write("(Company Stamp and", left + half + 40, y, half - 40, { size: 9 });
  y += 12;
  write("Signature) Date :", left + half + 40, y, half - 40, { size: 9 });

  write("1 | Page", left, doc.page.height - 40, width, {
    size: 8,
    align: "right",
    color: "#888",
  });

  doc.end();
  return done;
}

const rfqItemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  quantity: z.number().int().positive(),
  pricePerUnit: z.number().positive(),
});

async function loadLogo() {
  return readFile(resolve(process.cwd(), "public/unikl.png"));
}

export const generateRfqFromForm = createServerFn({ method: "POST" })
  .validator(
    z.object({
      items: z.array(rfqItemSchema).min(1).max(50),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const { user } = context;
    const now = new Date();
    const rfqNumber = `RFQ-${String(user.userId).padStart(3, "0")}-${now
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "")}`;
    const logo = await loadLogo();

    const pdfBuffer = await buildRfqPdf({
      rfqNumber,
      rfqDate: now.toLocaleDateString("en-GB"),
      email: user.email,
      department: user.department ?? "",
      items: data.items.map((item) => ({
        item_name: item.name,
        item_description: "",
        item_quantity: item.quantity,
        item_price: item.pricePerUnit,
      })),
      logo,
    });

    return {
      fileName: `${rfqNumber}-request-for-quotation.pdf`,
      data: pdfBuffer.toString("base64"),
    };
  });