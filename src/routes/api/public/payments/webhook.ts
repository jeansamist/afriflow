import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";

async function getAdmin() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function handlePaymentIntentSucceeded(intent: any) {
  const paymentLinkId = intent.metadata?.payment_link_id;
  if (!paymentLinkId) {
    console.warn("[webhook] payment_intent.succeeded without payment_link_id metadata");
    return;
  }
  const admin = await getAdmin();

  const { data: link } = await admin
    .from("payment_links")
    .select("*")
    .eq("id", paymentLinkId)
    .maybeSingle();
  if (!link) return;
  if (link.status === "PAID") return; // idempotent — client-side already marked it

  await admin
    .from("payment_links")
    .update({ status: "PAID", stripe_payment_intent_id: intent.id })
    .eq("id", paymentLinkId);

  await admin.from("ledger_entries").insert({
    user_id: link.user_id,
    amount: link.amount,
    currency: link.currency,
    entry_type: "CREDIT",
    reference_id: `payment_link:${link.id}`,
    metadata: {
      source: "stripe_webhook",
      payment_intent_id: intent.id,
    },
  });

  try {
    const { simulatePayoutForPaymentLink } = await import("@/lib/payout-simulator.server");
    const refreshed = await admin
      .from("payment_links")
      .select("*")
      .eq("id", link.id)
      .single();
    if (refreshed.data) {
      await simulatePayoutForPaymentLink(admin, refreshed.data as any);
    }
  } catch (e) {
    console.error("[webhook] payout simulation failed", e);
  }
}

async function handlePaymentIntentFailed(intent: any) {
  const paymentLinkId = intent.metadata?.payment_link_id;
  if (!paymentLinkId) return;
  const admin = await getAdmin();
  await admin
    .from("payment_links")
    .update({ status: "EXPIRED" })
    .eq("id", paymentLinkId)
    .neq("status", "PAID");
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      await handlePaymentIntentFailed(event.data.object);
      break;
    default:
      console.log("[webhook] unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[webhook] invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[webhook] error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
