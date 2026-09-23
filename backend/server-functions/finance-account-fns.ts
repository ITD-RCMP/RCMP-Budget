import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { roleMiddleware } from "@backend/core/middleware";
import type { AuthUser } from "@/lib/auth";

const APPROVED_BUDGET_STATUS_ID = 12;

const hodOnly = roleMiddleware("HOD");

export type AccountType = "CAPEX" | "OPEX";

export type FinanceAccountSummary = {
  accountType: AccountType;
  credited: number;
  debited: number;
  balance: number;
};

export type FinanceOverview = {
  budgetYear: number;
  totalAllocation: number;
  totalSpent: number;
  totalBalance: number;
  accounts: FinanceAccountSummary[];
};

export type MonthlyBudgetPoint = {
  month: string;
  budget: number;
  actual: number;
};

export type CodeBudgetTotal = {
  code: string;
  budgetType: "OPEX" | "CAPEX";
  amount: number;
};

export type HodDashboardStats = FinanceOverview & {
  departmentName: string | null;
  staffId: number | null;
  displayName: string;
  fullName: string | null;
  lastYearAllocation: number;
  requestedCapex: number;
  requestedOpex: number;
  monthly: MonthlyBudgetPoint[];
  codeBudgets: CodeBudgetTotal[];
  totalCodeBudget: number;
};

type MonthSumRow = {
  month_key: string;
  total: string | number;
};

type AccountRow = {
  account_id: number;
  account_type: string;
  account_balance: string | number;
  credited: string | number;
  debited: string | number;
};

function requireDepartment(user: AuthUser): AuthUser {
  if (user.departmentId == null) {
    throw new Error("Your account has no department. Ask an admin to assign one.");
  }
  return user;
}

type ApprovedBudgetRow = {
  budget_type: string;
  total_amount: string | number;
};

type CodeBudgetRow = {
  code: string;
  budget_type: string;
  total: string | number;
};

async function loadOverview(departmentId: number, budgetYear: number): Promise<FinanceOverview> {
  const { query } = await import("@backend/core/db");

  const rows = await query<AccountRow[]>(
    `SELECT
       fa.account_id,
       fa.account_type,
       fa.account_balance,
       COALESCE(SUM(CASE WHEN fe.entry_type = 'IN' THEN fe.amount END), 0) AS credited,
       COALESCE(SUM(CASE WHEN fe.entry_type = 'OUT' THEN fe.amount END), 0) AS debited
     FROM finance_accounts fa
     LEFT JOIN finance_account_entries fe ON fe.account_id = fa.account_id
     WHERE fa.department_id = ? AND fa.budget_year = ?
     GROUP BY fa.account_id, fa.account_type, fa.account_balance`,
    [departmentId, budgetYear],
  );

  const approvedBudgets = await query<ApprovedBudgetRow[]>(
    `SELECT
       yb.budget_type,
       COALESCE(SUM(yb.budget_amount), 0) AS total_amount
     FROM yearly_budgets yb
     INNER JOIN quotation_statuses qs ON qs.status_id = yb.status_id
     INNER JOIN users u ON u.user_id = yb.created_by
     WHERE u.department_id = ?
       AND yb.budget_year = ?
       AND qs.status_name = 'approved budget'
     GROUP BY yb.budget_type`,
    [departmentId, budgetYear],
  );

  const accounts: FinanceAccountSummary[] = (["CAPEX", "OPEX"] as const).map((accountType) => {
    const row = rows.find((item) => item.account_type === accountType);
    const approved = approvedBudgets.find((item) => item.budget_type === accountType);
    const credited = row ? Number(row.credited) : 0;
    const manualOut = row ? Number(row.debited) : 0;
    const approvedOut = approved ? Number(approved.total_amount) : 0;
    const debited = manualOut + approvedOut;
    return {
      accountType,
      credited,
      debited,
      balance: credited - debited,
    };
  });

  const totalAllocation = accounts.reduce((sum, a) => sum + a.credited, 0);
  const totalSpent = accounts.reduce((sum, a) => sum + a.debited, 0);
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return { budgetYear, totalAllocation, totalSpent, totalBalance, accounts };
}

export const getHodFinanceOverview = createServerFn({ method: "GET" })
  .middleware([hodOnly])
  .handler(async ({ context }): Promise<FinanceOverview> => {
    const user = requireDepartment(context.user);
    return loadOverview(user.departmentId as number, new Date().getFullYear());
  });

export const getHodDashboardStats = createServerFn({ method: "GET" })
  .middleware([hodOnly])
  .handler(async ({ context }): Promise<HodDashboardStats> => {
    const user = requireDepartment(context.user);
    const departmentId = user.departmentId as number;
    const now = new Date();
    const budgetYear = now.getFullYear();
    const overview = await loadOverview(departmentId, budgetYear);
    const { query } = await import("@backend/core/db");

    const lastYearRows = await query<{ total: string | number }[]>(
      `SELECT COALESCE(SUM(CASE WHEN fe.entry_type = 'IN' THEN fe.amount END), 0) AS total
       FROM finance_accounts fa
       LEFT JOIN finance_account_entries fe ON fe.account_id = fa.account_id
       WHERE fa.department_id = ? AND fa.budget_year = ?`,
      [departmentId, budgetYear - 1],
    );

    const outRows = await query<MonthSumRow[]>(
      `SELECT DATE_FORMAT(fe.created_at, '%Y-%m') AS month_key,
              COALESCE(SUM(fe.amount), 0) AS total
       FROM finance_account_entries fe
       INNER JOIN finance_accounts fa ON fa.account_id = fe.account_id
       WHERE fa.department_id = ?
         AND fa.budget_year = ?
         AND fe.entry_type = 'OUT'
       GROUP BY DATE_FORMAT(fe.created_at, '%Y-%m')`,
      [departmentId, budgetYear],
    );

    const approvedRows = await query<MonthSumRow[]>(
      `SELECT DATE_FORMAT(yb.updated_at, '%Y-%m') AS month_key,
              COALESCE(SUM(yb.budget_amount), 0) AS total
       FROM yearly_budgets yb
       INNER JOIN quotation_statuses qs ON qs.status_id = yb.status_id
       INNER JOIN users u ON u.user_id = yb.created_by
       WHERE u.department_id = ?
         AND yb.budget_year = ?
         AND qs.status_name = 'approved budget'
       GROUP BY DATE_FORMAT(yb.updated_at, '%Y-%m')`,
      [departmentId, budgetYear],
    );

    const actualByMonth = new Map<string, number>();
    for (const row of [...outRows, ...approvedRows]) {
      actualByMonth.set(row.month_key, (actualByMonth.get(row.month_key) ?? 0) + Number(row.total));
    }

    const monthlyBudget = overview.totalAllocation / 12;
    const monthCount = now.getMonth() + 1;
    const monthly: MonthlyBudgetPoint[] = [];
    for (let index = 0; index < monthCount; index += 1) {
      const key = `${budgetYear}-${String(index + 1).padStart(2, "0")}`;
      monthly.push({
        month: new Date(budgetYear, index, 1).toLocaleDateString("en-GB", {
          month: "short",
        }),
        budget: monthlyBudget,
        actual: actualByMonth.get(key) ?? 0,
      });
    }

    const requestedRows = await query<ApprovedBudgetRow[]>(
      `SELECT yb.budget_type, COALESCE(SUM(yb.budget_amount), 0) AS total_amount
       FROM yearly_budgets yb
       INNER JOIN quotation_statuses qs ON qs.status_id = yb.status_id
       INNER JOIN users u ON u.user_id = yb.created_by
       WHERE u.department_id = ?
         AND yb.budget_year = ?
         AND qs.status_name NOT LIKE '%rejected%'
       GROUP BY yb.budget_type`,
      [departmentId, budgetYear],
    );

    let requestedCapex = 0;
    let requestedOpex = 0;
    for (const row of requestedRows) {
      const total = Number(row.total_amount);
      if (row.budget_type === "CAPEX") requestedCapex = total;
      if (row.budget_type === "OPEX") requestedOpex = total;
    }

    const codeRows = await query<CodeBudgetRow[]>(
      `SELECT yb.code, yb.budget_type, COALESCE(SUM(yb.budget_amount), 0) AS total
       FROM yearly_budgets yb
       INNER JOIN quotation_statuses qs ON qs.status_id = yb.status_id
       INNER JOIN users u ON u.user_id = yb.created_by
       WHERE u.department_id = ?
         AND yb.budget_year = ?
         AND qs.status_name NOT LIKE '%rejected%'
       GROUP BY yb.code, yb.budget_type
       ORDER BY total DESC`,
      [departmentId, budgetYear],
    );

    const codeBudgets: CodeBudgetTotal[] = codeRows.map((row) => ({
      code: row.code,
      budgetType: row.budget_type === "CAPEX" ? "CAPEX" : "OPEX",
      amount: Number(row.total),
    }));
    const totalCodeBudget = codeBudgets.reduce((sum, row) => sum + row.amount, 0);

    const { resolveUserFullName } = await import(
      "@backend/server-functions/microsoft-graph"
    );
    const fullName = await resolveUserFullName({
      userId: user.userId,
      sessionFullName: user.fullName,
    });

    return {
      ...overview,
      departmentName: user.department,
      staffId: user.staffId,
      displayName:
        user.designation?.trim() || user.email.split("@")[0]?.replace(/[._]/g, " ") || user.email,
      fullName,
      lastYearAllocation: Number(lastYearRows[0]?.total ?? 0),
      requestedCapex,
      requestedOpex,
      monthly,
      codeBudgets,
      totalCodeBudget,
    };
  });

export const recordFinanceEntry = createServerFn({ method: "POST" })
  .validator(
    z.object({
      accountType: z.enum(["CAPEX", "OPEX"]),
      entryType: z.enum(["IN", "OUT"]),
      amount: z.number().positive().max(99999999),
      remarks: z.string().max(255).optional(),
    }),
  )
  .middleware([hodOnly])
  .handler(async ({ data, context }): Promise<FinanceOverview> => {
    const user = requireDepartment(context.user);
    const departmentId = user.departmentId as number;
    const budgetYear = new Date().getFullYear();

    const { query } = await import("@backend/core/db");

    const existing = await query<{ account_id: number }[]>(
      `SELECT account_id
       FROM finance_accounts
       WHERE department_id = ? AND account_type = ? AND budget_year = ?
       LIMIT 1`,
      [departmentId, data.accountType, budgetYear],
    );

    let accountId: number;

    if (existing[0]) {
      accountId = existing[0].account_id;
    } else {
      const result = await query<{ insertId: number }>(
        `INSERT IGNORE INTO finance_accounts
           (department_id, status_id, account_name, account_type, budget_year, account_balance, edited_by)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [
          departmentId,
          APPROVED_BUDGET_STATUS_ID,
          `${data.accountType} ${budgetYear}`,
          data.accountType,
          budgetYear,
          user.userId,
        ],
      );
      if (result.insertId) {
        accountId = result.insertId;
      } else {
        const retry = await query<{ account_id: number }[]>(
          `SELECT account_id
           FROM finance_accounts
           WHERE department_id = ? AND account_type = ? AND budget_year = ?
           LIMIT 1`,
          [departmentId, data.accountType, budgetYear],
        );
        if (!retry[0]) {
          throw new Error("Could not open the account. Please try again.");
        }
        accountId = retry[0].account_id;
      }
    }

    const signedAmount = data.entryType === "IN" ? data.amount : -data.amount;

    if (data.entryType === "OUT") {
      const overview = await loadOverview(departmentId, budgetYear);
      const account = overview.accounts.find((item) => item.accountType === data.accountType);
      const remaining = account?.balance ?? 0;
      if (data.amount > remaining) {
        throw new Error("Not enough balance in this account. Enter a smaller amount.");
      }
    }

    await query(
      `INSERT INTO finance_account_entries (account_id, entry_type, amount, remarks, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [accountId, data.entryType, data.amount, data.remarks ?? null, user.userId],
    );

    await query(
      `UPDATE finance_accounts
       SET account_balance = account_balance + ?, edited_by = ?
       WHERE account_id = ?`,
      [signedAmount, user.userId, accountId],
    );

    return loadOverview(departmentId, budgetYear);
  });
