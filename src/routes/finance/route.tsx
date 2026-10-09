import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";

export const Route = createFileRoute("/finance")({
  beforeLoad: requireRole("Finance"),
  component: () => <Outlet />,
});
