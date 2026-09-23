import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { roleMiddleware } from "@backend/core/middleware";
import type { AuthUser } from "@/lib/auth";

const userOnly = roleMiddleware("User");

export type DepartmentBudgetStatus = "Pending" | "Approved" | "Rejected";

export type DepartmentBudgetItem = {
  id: number;
  itemName: string | null;
  quantity: number;
  costPerUnit: number;
  amount: number;
};

export type DepartmentBudgetDetail = {
  id: number;
  budgetRef: string;
  budgetYear: number;
  budgetType: "OPEX" | "CAPEX";
  code: string;
  activity: string | null;
  itemName: string | null;
  targetMonths: string | null;
  objective: string | null;
  justification: string;
  quantity: number | null;
  costPerUnit: number | null;
  amount: number;
  items: DepartmentBudgetItem[];
  effectIfNotApproved: string | null;
  alternative: string | null;
  remarks: string | null;
  rejectRemarks: string | null;
  date: string;
  status: DepartmentBudgetStatus;
  statusName: string;
  requester: string;
  department: string | null;
  designation: string | null;
};

type BudgetRow = {
  budget_id: number;
  budget_ref?: string | null;
  budget_year: number;
  budget_type: string;
  code: string;
  activity: string | null;
  target_months: string | null;
  objective: string | null;
  justification: string;
  budget_amount: string | number;
  effect_if_not_approved: string | null;
  alternative: string | null;
  remarks: string | null;
  reject_remarks: string | null;
  status_name: string;
  created_at: Date | string;
  requester_email: string;
  department: string | null;
  designation: string | null;
};

type BudgetItemRow = {
  budget_item_id: number;
  budget_id: number;
  item_name: string | null;
  quantity: number;
  cost_per_unit: string | number;
  budget_amount: string | number;
};

function mapBudgetStatus(statusName: string): DepartmentBudgetStatus {
  if (statusName.includes("rejected")) return "Rejected";
  if (statusName.includes("approved") || statusName === "completed") {
    return "Approved";
  }
  return "Pending";
}

function formatDate(value: Date | string) {
  const created = value instanceof Date ? value : new Date(value);
  return created.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toBudgetItem(row: BudgetItemRow): DepartmentBudgetItem {
  return {
    id: row.budget_item_id,
    itemName: row.item_name,
    quantity: Number(row.quantity),
    costPerUnit: Number(row.cost_per_unit),
    amount: Number(row.budget_amount),
  };
}

function toBudgetDetail(row: BudgetRow, items: DepartmentBudgetItem[]): DepartmentBudgetDetail {
  const first = items[0] ?? null;
  return {
    id: row.budget_id,
    budgetRef: row.budget_ref || `YB-${row.budget_id}`,
    budgetYear: Number(row.budget_year),
    budgetType: row.budget_type === "CAPEX" ? "CAPEX" : "OPEX",
    code: row.code,
    activity: row.activity,
    itemName: first?.itemName ?? null,
    targetMonths: row.target_months,
    objective: row.objective,
    justification: row.justification,
    quantity: first?.quantity ?? null,
    costPerUnit: first?.costPerUnit ?? null,
    amount: Number(row.budget_amount),
    items,
    effectIfNotApproved: row.effect_if_not_approved,
    alternative: row.alternative,
    remarks: row.remarks,
    rejectRemarks: row.reject_remarks,
    date: formatDate(row.created_at),
    status: mapBudgetStatus(row.status_name),
    statusName: row.status_name,
    requester: row.requester_email,
    department: row.department,
    designation: row.designation,
  };
}

function departmentBudgetScope(user: AuthUser) {
  if (user.departmentId != null) {
    return {
      filter: "AND (u.department_id = ? OR yb.created_by = ?)",
      params: [user.departmentId, user.userId] as unknown[],
    };
  }
  return {
    filter: "AND yb.created_by = ?",
    params: [user.userId] as unknown[],
  };
}

export const listDepartmentBudgetYears = createServerFn({ method: "GET" })
  .middleware([userOnly])
  .handler(async ({ context }): Promise<number[]> => {
    const { user } = context;
    const { query } = await import("@backend/core/db");
    const scope = departmentBudgetScope(user);
    const rows = await query<{ budget_year: number }[]>(
      `SELECT DISTINCT yb.budget_year
       FROM yearly_budgets yb
       INNER JOIN quotation_statuses qs ON qs.status_id = yb.status_id
       INNER JOIN users u ON u.user_id = yb.created_by
       WHERE qs.status_name NOT LIKE '%rejected%'
       ${scope.filter}
       ORDER BY yb.budget_year DESC`,
      scope.params,
    );
    return rows.map((row) => Number(row.budget_year));
  });

export const listDepartmentBudgetReport = createServerFn({ method: "GET" })
  .validator(
    z.object({
      budgetYear: z.number().int().min(2000).max(2100).optional(),
    }),
  )
  .middleware([userOnly])
  .handler(async ({ data, context }): Promise<DepartmentBudgetDetail[]> => {
    const { user } = context;

    const { query } = await import("@backend/core/db");
    const budgetYear = data.budgetYear ?? new Date().getFullYear();
    const scope = departmentBudgetScope(user);
    const params: unknown[] = [budgetYear, ...scope.params];

    const rows = await query<BudgetRow[]>(
      `SELECT
         yb.budget_id,
         yb.budget_ref,
         yb.budget_year,
         yb.budget_type,
         yb.code,
         yb.activity,
         yb.target_months,
         yb.objective,
         yb.justification,
         yb.budget_amount,
         yb.effect_if_not_approved,
         yb.alternative,
         yb.remarks,
         yb.reject_remarks,
         yb.created_at,
         qs.status_name,
         u.email AS requester_email,
         d.department_name AS department,
         u.designation
       FROM yearly_budgets yb
       INNER JOIN quotation_statuses qs ON qs.status_id = yb.status_id
       INNER JOIN users u ON u.user_id = yb.created_by
       LEFT JOIN departments d ON d.department_id = u.department_id
       WHERE yb.budget_year = ?
         AND qs.status_name NOT LIKE '%rejected%'
       ${scope.filter}
       ORDER BY yb.budget_type ASC, yb.code ASC, yb.budget_id ASC`,
      params,
    );

    if (rows.length === 0) return [];

    const budgetIds = rows.map((row) => row.budget_id);
    const placeholders = budgetIds.map(() => "?").join(", ");
    const itemRows = await query<BudgetItemRow[]>(
      `SELECT
         budget_item_id,
         budget_id,
         item_name,
         quantity,
         cost_per_unit,
         budget_amount
       FROM budget_items
       WHERE budget_id IN (${placeholders})
       ORDER BY budget_id ASC, budget_item_id ASC`,
      budgetIds,
    );

    const itemsByBudget = new Map<number, DepartmentBudgetItem[]>();
    for (const item of itemRows) {
      const list = itemsByBudget.get(item.budget_id) ?? [];
      list.push(toBudgetItem(item));
      itemsByBudget.set(item.budget_id, list);
    }

    return rows.map((row) => toBudgetDetail(row, itemsByBudget.get(row.budget_id) ?? []));
  });
