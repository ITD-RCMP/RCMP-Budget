import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { roleMiddleware } from "@backend/core/middleware";
import type { AuthUser } from "@/lib/auth";
import {
  receivedStampDate,
  receivedStampDepartment,
  stampReceivedPdf,
} from "@/lib/received-stamp";

const billingAccess = roleMiddleware("User", "HOD");

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type Billing = {
  id: number;
  invoiceRef: string;
  supplier: string;
  invoiceDate: string;
  invoiceMonth: string;
  totalInvoice: number | null;
  createdBy: string;
  hasPdf: boolean;
  emailTo: string[];
  emailSentAt: string | null;
  acknowledgedName: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
};

type BillingRow = {
  billing_id: number;
  invoice_ref: string;
  supplier: string;
  invoice_date: Date | string;
  invoice_month: string;
  total_invoice: string | number | null;
  creator_email: string;
  pdf_path: string | null;
  email_to: string | null;
  email_sent_at: Date | string | null;
  acknowledged_name: string | null;
  acknowledged_at: Date | string | null;
  created_at: Date | string;
};

function toIso(value: Date | string | null) {
  if (value == null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toDateOnly(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toBilling(row: BillingRow): Billing {
  return {
    id: row.billing_id,
    invoiceRef: row.invoice_ref,
    supplier: row.supplier,
    invoiceDate: toDateOnly(row.invoice_date),
    invoiceMonth: row.invoice_month,
    totalInvoice: row.total_invoice == null ? null : Number(row.total_invoice),
    createdBy: row.creator_email,
    hasPdf: Boolean(row.pdf_path),
    emailTo: row.email_to ? row.email_to.split(",") : [],
    emailSentAt: toIso(row.email_sent_at),
    acknowledgedName: row.acknowledged_name,
    acknowledgedAt: toIso(row.acknowledged_at),
    createdAt: toIso(row.created_at) ?? "",
  };
}

function billingScope(user: AuthUser) {
  if (user.departmentId != null) {
    return { filter: "b.department_id = ?", params: [user.departmentId] as unknown[] };
  }
  return { filter: "b.created_by = ?", params: [user.userId] as unknown[] };
}

function invoicePdfRelative(invoiceDate: string, invoiceRef: string) {
  const year = invoiceDate.slice(0, 4);
  if (!/^\d{4}$/.test(year) || !/^INV-\d{2}-\d{4}$/.test(invoiceRef)) {
    throw new Error("Could not save this bill. Please try again.");
  }
  return `uploads/${year}/${invoiceRef}.pdf`;
}

async function absolutePdfPath(stored: string) {
  const { isAbsolute, relative, resolve, sep } = await import("node:path");
  const root = resolve(process.cwd(), "uploads");
  const full = stored.startsWith("uploads/")
    ? resolve(process.cwd(), stored)
    : resolve(root, "billings", stored);
  const fromRoot = relative(root, full);
  if (!fromRoot || fromRoot.startsWith("..") || fromRoot.split(sep).includes("..") || isAbsolute(fromRoot)) {
    throw new Error("This bill was not found. Refresh the page and try again.");
  }
  return full;
}

async function findBilling(user: AuthUser, billingId: number) {
  const { query } = await import("@backend/core/db");
  const scope = billingScope(user);
  const rows = await query<BillingRow[]>(
    `SELECT b.*, u.email AS creator_email
     FROM billings b
     INNER JOIN users u ON u.user_id = b.created_by
     WHERE b.billing_id = ? AND ${scope.filter}
     LIMIT 1`,
    [billingId, ...scope.params],
  );
  const row = rows[0];
  if (!row) throw new Error("This bill was not found. Refresh the page and try again.");
  return row;
}

async function readPdf(storedPath: string) {
  const { readFile } = await import("node:fs/promises");
  return readFile(await absolutePdfPath(storedPath));
}

async function writePdf(storedPath: string, bytes: Uint8Array) {
  const { dirname } = await import("node:path");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const full = await absolutePdfPath(storedPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

const billingIdSchema = z.object({ billingId: z.number().int().positive() });

function isDuplicate(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  );
}

async function nextInvoiceRef(
  query: (sql: string, values?: unknown[]) => Promise<unknown>,
  invoiceDate: string,
) {
  const year = invoiceDate.slice(2, 4);
  const rows = (await query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(invoice_ref, '-', -1) AS UNSIGNED)), 0) AS seq
     FROM billings
     WHERE invoice_ref LIKE ?`,
    [`INV-${year}-%`],
  )) as { seq: number | string }[];
  const sequence = Number(rows[0]?.seq ?? 0) + 1;
  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}

export const listBillings = createServerFn({ method: "GET" })
  .middleware([billingAccess])
  .handler(async ({ context }): Promise<Billing[]> => {
    const { query } = await import("@backend/core/db");
    const scope = billingScope(context.user);
    const rows = await query<BillingRow[]>(
      `SELECT b.*, u.email AS creator_email
       FROM billings b
       INNER JOIN users u ON u.user_id = b.created_by
       WHERE ${scope.filter}
       ORDER BY b.invoice_date DESC, b.billing_id DESC`,
      scope.params,
    );
    return rows.map(toBilling);
  });

export const createBilling = createServerFn({ method: "POST" })
  .validator(
    z.object({
      supplier: z.string().trim().min(1).max(255),
      invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      totalInvoice: z.number().positive().max(99999999.99),
      pdfBase64: z.string().min(1),
    }),
  )
  .middleware([billingAccess])
  .handler(async ({ data, context }): Promise<{ id: number; invoiceRef: string }> => {
    const { user } = context;
    if (user.departmentId == null) {
      throw new Error("Your account has no department. Ask an admin to assign one.");
    }
    const pdf = Buffer.from(data.pdfBase64, "base64");
    if (pdf.length > MAX_PDF_BYTES || pdf.subarray(0, 4).toString() !== "%PDF") {
      throw new Error("This scan could not be saved. Retake the photo and try again.");
    }

    const { query } = await import("@backend/core/db");
    for (let attempt = 0; attempt < 5; attempt++) {
      const invoiceRef = await nextInvoiceRef(query, data.invoiceDate);
      const pdfPath = invoicePdfRelative(data.invoiceDate, invoiceRef);
      let billingId: number | null = null;
      try {
        const result = await query<{ insertId: number }>(
          `INSERT INTO billings
             (invoice_ref, department_id, created_by, supplier, invoice_date, total_invoice, pdf_path)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceRef,
            user.departmentId,
            user.userId,
            data.supplier,
            data.invoiceDate,
            Math.round(data.totalInvoice * 100) / 100,
            pdfPath,
          ],
        );
        billingId = result.insertId;
        await writePdf(pdfPath, pdf);
        return { id: billingId, invoiceRef };
      } catch (error) {
        if (billingId != null) {
          await query(`DELETE FROM billings WHERE billing_id = ?`, [billingId]);
          throw new Error("Could not save this bill. Please try again.");
        }
        if (!isDuplicate(error) || attempt === 4) {
          throw new Error("Could not save this bill. Please try again.");
        }
      }
    }
    throw new Error("Could not save this bill. Please try again.");
  });

export const getBillingPdf = createServerFn({ method: "GET" })
  .validator(billingIdSchema)
  .middleware([billingAccess])
  .handler(async ({ data, context }): Promise<{ fileName: string; data: string }> => {
    const row = await findBilling(context.user, data.billingId);
    if (!row.pdf_path) throw new Error("This bill has no PDF yet. Scan the invoice first.");
    const pdf = await readPdf(row.pdf_path);
    return {
      fileName: `${row.invoice_ref}.pdf`,
      data: pdf.toString("base64"),
    };
  });

export const sendBillingEmail = createServerFn({ method: "POST" })
  .validator(
    billingIdSchema.extend({
      to: z.array(z.string().trim().email()).min(1).max(10),
      message: z.string().trim().max(2000),
    }),
  )
  .middleware([billingAccess])
  .handler(async ({ data, context }): Promise<{ sentAt: string }> => {
    const row = await findBilling(context.user, data.billingId);
    if (!row.acknowledged_at) {
      throw new Error("Acknowledge this invoice before sending it.");
    }
    if (!row.pdf_path) throw new Error("This bill has no PDF yet. Scan the invoice first.");
    if (data.to.some((email) => !email.toLowerCase().endsWith("@unikl.edu.my"))) {
      throw new Error("Use an email that ends with @unikl.edu.my, then try again.");
    }

    const { loadEnvFile } = await import("@backend/core/env");
    loadEnvFile();

    const invoiceDate = toDateOnly(row.invoice_date);
    const text =
      data.message || `Please find the attached invoice ${row.invoice_ref} from ${row.supplier}.`;
    const subject = `${row.invoice_ref} from ${row.supplier} (${invoiceDate})`;
    const fileName = `${row.invoice_ref}.pdf`;
    const pdf = await readPdf(row.pdf_path);
    const staffName = context.user.fullName?.replace(/["<>]/g, "").trim();

    try {
      const nodemailer = (await import("nodemailer")).default;
      const isProduction = process.env.NODE_ENV === "production";
      const from = isProduction ? process.env.MICROSOFT_MAIL_FROM?.trim() : process.env.SMTP_FROM?.trim();
      const password = isProduction ? process.env.MICROSOFT_MAIL_PASSWORD : process.env.SMTP_PASS;
      const user = isProduction ? from : process.env.SMTP_USER?.trim();
      const host = isProduction ? "smtp.office365.com" : process.env.SMTP_HOST?.trim();
      const port = isProduction ? 587 : Number(process.env.SMTP_PORT ?? 1025);
      if (!host || !from || (isProduction && !password?.trim())) {
        throw new Error("Email is not set up yet. Ask an admin to finish mail settings.");
      }
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: isProduction,
        auth: user ? { user, pass: password ?? "" } : undefined,
      });
      await transport.sendMail({
        from,
        to: data.to,
        replyTo: staffName ? `${staffName} <${context.user.email}>` : context.user.email,
        subject,
        text,
        attachments: [{ filename: fileName, content: pdf }],
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Email is not set up")) throw error;
      throw new Error("The email could not be sent. Check the address and try again.");
    }

    const { query } = await import("@backend/core/db");
    await query(
      `UPDATE billings SET email_to = ?, email_sent_at = NOW()
       WHERE billing_id = ?`,
      [data.to.join(","), row.billing_id],
    );
    return { sentAt: new Date().toISOString() };
  });

export const getBilling = createServerFn({ method: "GET" })
  .validator(billingIdSchema)
  .middleware([billingAccess])
  .handler(async ({ data, context }): Promise<Billing> => {
    const row = await findBilling(context.user, data.billingId);
    return toBilling(row);
  });

export const acknowledgeBilling = createServerFn({ method: "POST" })
  .validator(
    billingIdSchema.extend({
      confirmed: z.boolean(),
    }),
  )
  .middleware([billingAccess])
  .handler(async ({ data, context }): Promise<void> => {
    if (!data.confirmed) {
      throw new Error("Tick the box, then submit.");
    }
    const { user } = context;
    const row = await findBilling(user, data.billingId);
    if (row.acknowledged_at) throw new Error("This bill is already acknowledged.");
    if (!row.pdf_path) throw new Error("This bill has no PDF yet. Scan the invoice first.");

    const staffName = user.fullName || user.email;
    const target = invoicePdfRelative(toDateOnly(row.invoice_date), row.invoice_ref);
    const stamped = await stampReceivedPdf(await readPdf(row.pdf_path), {
      staffName,
      receivedOn: receivedStampDate(),
      department: receivedStampDepartment,
    });
    await writePdf(target, stamped);
    if (row.pdf_path !== target) {
      const { unlink } = await import("node:fs/promises");
      await unlink(await absolutePdfPath(row.pdf_path)).catch(() => undefined);
    }

    const { query } = await import("@backend/core/db");
    await query(
      `UPDATE billings
       SET pdf_path = ?, acknowledged_by = ?, acknowledged_name = ?, acknowledged_at = NOW()
       WHERE billing_id = ? AND acknowledged_at IS NULL`,
      [target, user.userId, staffName, row.billing_id],
    );
  });
