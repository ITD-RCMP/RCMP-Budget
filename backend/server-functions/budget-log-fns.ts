import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, roleMiddleware } from "@backend/core/middleware";
import {
  budgetSnapshot,
  parseSnapshot,
  type BudgetAction,
  type BudgetSnapshot,
} from "@backend/core/budget-action-log";
import type { AuthUser } from "@/lib/auth";

export type BudgetActionLog = {
  id: number;
  budgetId: number | null;
  budgetRef: string;
  budgetYear: number;
  budgetType: "OPEX" | "CAPEX";
  action: BudgetAction;
  actorEmail: string;
  ownerEmail: string;
  remarks: string | null;
  oldValues: BudgetSnapshot;
  newValues: BudgetSnapshot | null;
  date: string;
  createdAt: string;
};

type LogRow = {
  log_id: number;
  budget_id: number | null;
  budget_ref: string;
  budget_year: number;
  budget_type: string;
  action: BudgetAction;
  remarks: string | null;
  old_values: unknown;
  new_values: unknown;
  created_at: Date | string;
  actor_email: string;
  owner_email: string;
};

function formatLogDate(value: Date | string) {
  const created = value instanceof Date ? value : new Date(value);
  return {
    date: created.toLocaleString("en-p", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    createdAt: created.toISOString(),
  };
}

function toLog(row: LogRow): BudgetActionLog | null {
  const oldValues = parseSnapshot(row.old_values);
  if (!oldValues && row.action !== "submit" && row.action !== "approve" && row.action !== "reject") {
    return null;
  }
  const { date, createdAt } = formatLogDate(row.created_at);
  return {
    id: row.log_id,
    budgetId: row.budget_id,
    budgetRef: row.budget_ref,
    budgetYear: Number(row.budget_year),
    budgetType: row.budget_type === "CAPEX" ? "CAPEX" : "OPEX",
    action: row.action,
    actorEmail: row.actor_email,
    ownerEmail: row.owner_email,
    remarks: row.remarks,
    oldValues: oldValues ?? {
      budgetType: row.budget_type === "CAPEX" ? "CAPEX" : "OPEX",
      code: "",
      activity: null,
      itemName: null,
      targetMonths: null,
      objective: null,
      justification: "",
      quantity: null,
      costPerUnit: null,
      amount: 0,
      effectIfNotApproved: null,
      alternative: null,
      remarks: null,
      status: "",
    },
    newValues: parseSnapshot(row.new_values),
    date,
    createdAt,
  };
}

const logSelect = `
  SELECT
    l.log_id,
    l.budget_id,
    COALESCE(yb.budget_ref, 'Deleted') AS budget_ref,
    l.budget_year,
    l.budget_type,
    l.action,
    l.remarks,
    l.old_values,
    l.new_values,
    l.created_at,
    actor.email AS actor_email,
    owner.email AS owner_email
  FROM budget_action_logs l
  LEFT JOIN yearly_budgets yb ON yb.budget_id = l.budget_id
  INNER JOIN users actor ON actor.user_id = l.actor_user_id
  INNER JOIN users owner ON owner.user_id = l.owner_user_id
`;

export const listMyBudgetLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BudgetActionLog[]> => {
    const { user } = context;
    const { query } = await import("@backend/core/db");
    const rows = await query<LogRow[]>(
      `${logSelect}
       WHERE l.owner_user_id = ?
       ORDER BY l.created_at DESC, l.log_id DESC`,
      [user.userId],
    );
    return rows.map(toLog).filter((row): row is BudgetActionLog => row != null);
  });

export const listMyBudgetLogsForBudget = createServerFn({ method: "GET" })
  .validator(z.object({ budgetId: z.number().int().positive() }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<BudgetActionLog[]> => {
    const { user } = context;
    const { query } = await import("@backend/core/db");
    const rows = await query<LogRow[]>(
      `${logSelect}
       WHERE l.budget_id = ?
         AND l.owner_user_id = ?
       ORDER BY l.created_at DESC, l.log_id DESC`,
      [data.budgetId, user.userId],
    );
    const logs = rows.map(toLog).filter((row): row is BudgetActionLog => row != null);

    const budgets = await query<
      Array<{
        budget_id: number;
        budget_ref: string | null;
        budget_year: number;
        budget_type: string;
        created_at: Date | string;
        updated_at?: Date | string | null;
        status_name: string;
        reject_remarks: string | null;
        email: string;
        code: string;
        activity: string | null;
        item_name: string | null;
        target_months: string | null;
        objective: string | null;
        justification: string;
        quantity: number | null;
        cost_per_unit: string | number | null;
        budget_amount: string | number;
        effect_if_not_approved: string | null;
        alternative: string | null;
        remarks: string | null;
      }>
    >(
      `SELECT
         yb.budget_id,
         yb.budget_ref,
         yb.budget_year,
         yb.budget_type,
         yb.created_at,
         yb.updated_at,
         qs.status_name,
         yb.reject_remarks,
         u.email,
         yb.code,
         yb.activity,
         (SELECT bi.item_name FROM budget_items bi
           WHERE bi.budget_id = yb.budget_id
           ORDER BY bi.budget_item_id ASC LIMIT 1) AS item_name,
         yb.target_months,
         yb.objective,
         yb.justification,
         (SELECT bi.quantity FROM budget_items bi
           WHERE bi.budget_id = yb.budget_id
           ORDER BY bi.budget_item_id ASC LIMIT 1) AS quantity,
         (SELECT bi.cost_per_unit FROM budget_items bi
           WHERE bi.budget_id = yb.budget_id
           ORDER BY bi.budget_item_id ASC LIMIT 1) AS cost_per_unit,
         yb.budget_amount,
         yb.effect_if_not_approved,
         yb.alternative,
         yb.remarks
       FROM yearly_budgets yb
       INNER JOIN quotation_statuses qs ON qs.status_id = yb.status_id
       INNER JOIN users u ON u.user_id = yb.created_by
       WHERE yb.budget_id = ?
         AND yb.created_by = ?
       LIMIT 1`,
      [data.budgetId, user.userId],
    );

    const budget = budgets[0];
    if (!budget) return logs;

    const snapshot = budgetSnapshot({
      budget_type: budget.budget_type,
      code: budget.code,
      activity: budget.activity,
      item_name: budget.item_name,
      target_months: budget.target_months,
      objective: budget.objective,
      justification: budget.justification,
      quantity: budget.quantity,
      cost_per_unit: budget.cost_per_unit,
      budget_amount: budget.budget_amount,
      effect_if_not_approved: budget.effect_if_not_approved,
      alternative: budget.alternative,
      remarks: budget.remarks,
      status_name: budget.status_name,
    });

    const lifecycle: BudgetActionLog[] = [...logs];
    const budgetType = budget.budget_type === "CAPEX" ? "CAPEX" : "OPEX";

    if (!lifecycle.some((row) => row.action === "submit")) {
      const { date, createdAt } = formatLogDate(budget.created_at);
      lifecycle.push({
        id: -budget.budget_id,
        budgetId: budget.budget_id,
        budgetRef: budget.budget_ref || "—",
        budgetYear: Number(budget.budget_year),
        budgetType,
        action: "submit",
        actorEmail: budget.email,
        ownerEmail: budget.email,
        remarks: null,
        oldValues: snapshot,
        newValues: null,
        date,
        createdAt,
      });
    }

    const status = budget.status_name.toLowerCase();
    const reviewedAt = budget.updated_at ?? budget.created_at;
    if (status.includes("approved") && !lifecycle.some((row) => row.action === "approve")) {
      const { date, createdAt } = formatLogDate(reviewedAt);
      lifecycle.push({
        id: -budget.budget_id - 1,
        budgetId: budget.budget_id,
        budgetRef: budget.budget_ref || "—",
        budgetYear: Number(budget.budget_year),
        budgetType,
        action: "approve",
        actorEmail: "HOD",
        ownerEmail: budget.email,
        remarks: null,
        oldValues: snapshot,
        newValues: snapshot,
        date,
        createdAt,
      });
    }
    if (status.includes("rejected") && !lifecycle.some((row) => row.action === "reject")) {
      const { date, createdAt } = formatLogDate(reviewedAt);
      lifecycle.push({
        id: -budget.budget_id - 2,
        budgetId: budget.budget_id,
        budgetRef: budget.budget_ref || "—",
        budgetYear: Number(budget.budget_year),
        budgetType,
        action: "reject",
        actorEmail: "HOD",
        ownerEmail: budget.email,
        remarks: budget.reject_remarks,
        oldValues: snapshot,
        newValues: snapshot,
        date,
        createdAt,
      });
    }

    return lifecycle.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        b.id - a.id,
    );
  });

function hodLogScope(user: AuthUser) {
  if (user.departmentId != null) {
    return {
      filter: "WHERE (l.owner_department_id = ? OR l.owner_user_id = ?)",
      params: [user.departmentId, user.userId] as unknown[],
    };
  }
  return { filter: "", params: [] as unknown[] };
}

export const listHodBudgetLogs = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("HOD")])
  .handler(async ({ context }): Promise<BudgetActionLog[]> => {
    const { user } = context;
    const { query } = await import("@backend/core/db");
    const scope = hodLogScope(user);
    const rows = await query<LogRow[]>(
      `${logSelect}
       ${scope.filter}
       ORDER BY l.created_at DESC, l.log_id DESC`,
      scope.params,
    );
    return rows.map(toLog).filter((row): row is BudgetActionLog => row != null);
  });
