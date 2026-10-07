import { createFileRoute } from "@tanstack/react-router";
import { BillingAcknowledgePage } from "@/features/user/billingAcknowledge";

export const Route = createFileRoute("/hod/billing/$billingId")({
  head: () => ({
    meta: [
      { title: "Acknowledge invoice — Budget Tracker" },
      {
        name: "description",
        content: "Read an invoice and confirm you acknowledge it.",
      },
    ],
  }),
  component: BillingAcknowledgeRoute,
});

function BillingAcknowledgeRoute() {
  const { billingId } = Route.useParams();
  return <BillingAcknowledgePage billingId={Number(billingId)} area="hod" />;
}
