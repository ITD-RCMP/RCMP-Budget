import type { FileRoutesByTo } from "@/routeTree.gen";

export type RoleName = "User" | "HOD" | "Finance";

export type AuthUser = {
  userId: number;
  staffId: number | null;
  email: string;
  fullName: string | null;
  departmentId: number | null;
  department: string | null;
  designation: string | null;
  roleId: number;
  roleName: RoleName;
};

export const roleHomeById: Partial<Record<number, keyof FileRoutesByTo>> = {
  1: "/user",
  2: "/hod",
  3: "/finance",
};

export const roleHome: Partial<Record<RoleName, keyof FileRoutesByTo>> = {
  User: "/user",
  HOD: "/hod",
  Finance: "/finance",
};

export function homeForRole(user: Pick<AuthUser, "roleId" | "roleName">) {
  return roleHomeById[user.roleId] ?? roleHome[user.roleName];
}
