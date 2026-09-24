import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@backend/core/middleware";

export type CalendarEventKind = "budget";

export type CalendarEventStatus = "Pending" | "Approved" | "Rejected";

export type DepartmentCalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  detail: string;
  requester: string;
  amount: number;
  status: CalendarEventStatus;
  statusName: string;
  createdAt: string;
};

type BudgetRow = {
  budget_id: number;
  budget_ref?: string | null;
  budget_year: number;
  budget_type: string;
  code: string;
  activity: string | null;
  item_name: string | null;
  target_months: string | null;
  budget_amount: string | number;
  status_name: string;
  created_at: Date | string;
  requester_email: string;
};

function mapStatus(statusName: string): CalendarEventStatus {
  if (statusName.includes("rejected")) return "Rejected";
  if (statusName.includes("approved") || statusName === "completed") {
    return "Approved";
  }
  return "Pending";
}

function budgetTitle(row: Pick<BudgetRow, "budget_type" | "activity" | "item_name">) {
  if (row.budget_type === "CAPEX") {
    return row.item_name?.trim() || "Capital expenditure";
  }
  return row.activity?.trim() || "Operating expenditure";
}

function toIso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function eventDateFromBudget(row: BudgetRow) {
  if (row.target_months && /^\d{4}-\d{2}$/.test(row.target_months)) {
    const [year, month] = row.target_months.split("-").map(Number);
    return new Date(year, month - 1, 1).toISOString();
  }
  return toIso(row.created_at);
}

function formatRm(value: number) {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export const listDepartmentCalendarEvents = createServerFn({
  method: "GET",
})
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DepartmentCalendarEvent[]> => {
    const { user } = context;

    const { query } = await import("@backend/core/db");
    const params: unknown[] = [];
    let departmentFilter = "";

    if (user.departmentId != null) {
      departmentFilter = "AND u.department_id = ?";
      params.push(user.departmentId);
    } else {
      departmentFilter = "AND u.user_id = ?";
      params.push(user.userId);
    }

    const budgetRows = await query<BudgetRow[]>(
      `SELECT
         yb.budget_id,
         yb.budget_ref,
         yb.budget_year,
         yb.budget_type,
         yb.code,
         yb.activity,
         (SELECT bi.item_name
          FROM budget_items bi
          WHERE bi.budget_id = yb.budget_id
          ORDER BY bi.budget_item_id ASC
          LIMIT 1) AS item_name,
         yb.target_months,
         yb.budget_amount,
         qs.status_name,
         yb.created_at,
         u.email AS requester_email
       FROM yearly_budgets yb
       INNER JOIN quotation_statuses qs ON qs.status_id = yb.status_id
       INNER JOIN users u ON u.user_id = yb.created_by
       WHERE 1 = 1
         AND qs.status_name NOT LIKE '%after meeting%'
       ${departmentFilter}
       ORDER BY yb.created_at DESC, yb.budget_id DESC`,
      params,
    );

    const budgetEvents: DepartmentCalendarEvent[] = budgetRows.map((row) => {
      const amount = Number(row.budget_amount);
      const status = mapStatus(row.status_name);
      const title = budgetTitle(row);
      const targetHint = row.target_months ? ` · Target ${row.target_months}` : "";
      return {
        id: `yb-${row.budget_id}`,
        kind: "budget",
        title: `${row.budget_ref || `YB-${row.budget_id}`} · ${row.budget_type} · ${title}`,
        detail: `${status} · ${formatRm(amount)} · ${row.requester_email}${targetHint}`,
        requester: row.requester_email,
        amount,
        status,
        statusName: row.status_name,
        createdAt: eventDateFromBudget(row),
      };
    });

    return budgetEvents.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });
