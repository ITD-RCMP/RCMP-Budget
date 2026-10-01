export type BudgetAction =
  | "submit"
  | "edit"
  | "transfer"
  | "delete"
  | "update_budget"
  | "approve"
  | "reject";

export type BudgetSnapshot = {
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
  effectIfNotApproved: string | null;
  alternative: string | null;
  remarks: string | null;
  status: string;
};

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

type SnapshotSource = {
  budget_year: number;
  budget_type: string;
  code: string;
  activity: string | null;
  item_name?: string | null;
  target_months: string | null;
  objective: string | null;
  justification: string;
  quantity?: number | null;
  cost_per_unit?: string | number | null;
  budget_amount: string | number;
  effect_if_not_approved: string | null;
  alternative: string | null;
  remarks: string | null;
  status_name: string;
};

export function budgetSnapshot(row: SnapshotSource): BudgetSnapshot {
  return {
    budgetYear: Number(row.budget_year),
    budgetType: row.budget_type === "CAPEX" ? "CAPEX" : "OPEX",
    code: row.code,
    activity: row.activity,
    itemName: row.item_name ?? null,
    targetMonths: row.target_months,
    objective: row.objective,
    justification: row.justification,
    quantity: row.quantity == null ? null : Number(row.quantity),
    costPerUnit:
      row.cost_per_unit == null ? null : Number(row.cost_per_unit),
    amount: Number(row.budget_amount),
    effectIfNotApproved: row.effect_if_not_approved,
    alternative: row.alternative,
    remarks: row.remarks,
    status: row.status_name,
  };
}

export async function insertBudgetActionLog(
  query: QueryFn,
  input: {
    budgetId: number;
    budgetYear: number;
    budgetType: "OPEX" | "CAPEX";
    action: BudgetAction;
    actorUserId: number;
    ownerUserId: number;
    ownerDepartmentId: number | null;
    remarks?: string | null;
    oldValues: BudgetSnapshot;
    newValues?: BudgetSnapshot | null;
  },
) {
  await query(
    `INSERT INTO budget_action_logs
       (budget_id, budget_year, budget_type, action,
        actor_user_id, owner_user_id, owner_department_id, remarks,
        old_values, new_values)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.budgetId,
      input.budgetYear,
      input.budgetType,
      input.action,
      input.actorUserId,
      input.ownerUserId,
      input.ownerDepartmentId,
      input.remarks?.trim() || null,
      JSON.stringify(input.oldValues),
      input.newValues ? JSON.stringify(input.newValues) : null,
    ],
  );
}

export function parseSnapshot(value: unknown): BudgetSnapshot | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as BudgetSnapshot;
    } catch {
      return null;
    }
  }
  return value as BudgetSnapshot;
}
