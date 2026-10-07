import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/hod/billing")({
  component: () => <Outlet />,
});
