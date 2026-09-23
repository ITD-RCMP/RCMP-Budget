import { createFileRoute } from "@tanstack/react-router";
import { HodReportPage } from "@/features/hod/report";

export const Route = createFileRoute("/hod/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Budget Tracker" },
      {
        name: "description",
        content:
          "View department OPEX and CAPEX reports.",
      },
    ],
  }),
  component: HodReportPage,
});
