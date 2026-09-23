import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthSession } from "@backend/core/session";
import type { AuthUser, RoleName } from "@/lib/auth";

type UserRow = {
  user_id: number;
  staff_id: number | null;
  email: string;
  department_id: number | null;
  department: string | null;
  designation: string | null;
  role_id: number;
  role_name: string;
};

function toAuthUser(row: UserRow): AuthUser {
  return {
    userId: row.user_id,
    staffId: row.staff_id,
    email: row.email,
    departmentId: row.department_id,
    department: row.department,
    designation: row.designation,
    roleId: row.role_id,
    roleName: row.role_name as RoleName,
  };
}

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthUser | null> => {
    const session = await getAuthSession();
    const current = session.data.user;
    if (!current) return null;

    const { query } = await import("@backend/core/db");
    const rows = await query<UserRow[]>(
      `SELECT u.user_id, u.staff_id, u.email, u.department_id,
              d.department_name AS department, u.designation, u.role_id, r.role_name
       FROM users u
       INNER JOIN roles r ON r.role_id = u.role_id
       LEFT JOIN departments d ON d.department_id = u.department_id
       WHERE u.user_id = ?
       LIMIT 1`,
      [current.userId],
    );

    const row = rows[0];
    if (!row) {
      await session.clear();
      return null;
    }

    const user = toAuthUser(row);
    await session.update({ user });
    return user;
  },
);

export const startMicrosoftLogin = createServerFn({ method: "POST" }).handler(async () => {
  const { startMicrosoftSso } = await import("@backend/server-functions/microsoft-sso");
  return startMicrosoftSso();
});

export const completeMicrosoftLogin = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const parsed = z
      .object({
        code: z.string().min(1),
        state: z.string().min(1),
      })
      .safeParse(input);
    if (!parsed.success) {
      throw new Error("Microsoft sign-in was incomplete. Start again from the login page.");
    }
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const { completeMicrosoftSso } = await import("@backend/server-functions/microsoft-sso");
    return completeMicrosoftSso(data);
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getAuthSession();
  await session.clear();
  return { ok: true as const };
});

export const devLoginAsRole = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const parsed = z
      .object({
        role: z.enum(["User", "HOD"]),
      })
      .safeParse(input);
    if (!parsed.success) {
      throw new Error("Pick User or HOD and try again.");
    }
    return parsed.data;
  })
  .handler(async ({ data }): Promise<AuthUser> => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Dev sign-in is only available in development.");
    }

    const { query } = await import("@backend/core/db");
    const rows = await query<UserRow[]>(
      `SELECT u.user_id, u.staff_id, u.email, u.department_id,
              d.department_name AS department, u.designation, u.role_id, r.role_name
       FROM users u
       INNER JOIN roles r ON r.role_id = u.role_id
       LEFT JOIN departments d ON d.department_id = u.department_id
       WHERE r.role_name = ?
       ORDER BY u.user_id ASC
       LIMIT 1`,
      [data.role],
    );

    const row = rows[0];
    if (!row) {
      throw new Error(`No ${data.role} account found in the database. Add one first.`);
    }

    const user = toAuthUser(row);
    await query("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?", [
      user.userId,
    ]);

    const session = await getAuthSession();
    await session.update({ user, msOAuth: undefined });
    return user;
  });
