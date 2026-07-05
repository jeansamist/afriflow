import { createFileRoute } from "@tanstack/react-router";

// Verify ElgioPay's HMAC-SHA256 signature.
// Header format: X-Elgiopay-Signature: t=<unix>,v1=<hex>
// Signed payload: "{t}.{raw_body}"
async function verifySignature(req: Request): Promise<any> {
  const raw = await req.text();
  const header = req.headers.get("x-elgiopay-signature") ?? "";

  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) {
    const eqIdx = kv.indexOf("=");
    if (eqIdx > 0) parts[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
  }

  const { t, v1 } = parts;
  if (!t || !v1) throw new Error("Missing signature fields");

  if (Math.abs(Date.now() / 1000 - Number(t)) > 300)
    throw new Error("Webhook timestamp too old (replay protection)");

  const secret = process.env.ELGIOPAY_WEBHOOK_SECRET ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${t}.${raw}`),
  );
  const expected = Buffer.from(new Uint8Array(signed)).toString("hex");

  // constant-time comparison
  if (expected.length !== v1.length || expected !== v1)
    throw new Error("Invalid webhook signature");

  return JSON.parse(raw);
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function handlePaymentCompleted(data: any) {
  const meta: Record<string, string> = data.metadata ?? {};
  const { user_id, phone_number, country_iso, monthly_price_usd } = meta;
  const txId: string = data.transaction_id;

  console.info("[elgiopay-webhook] handlePaymentCompleted", {
    txId,
    user_id,
    phone_number,
    country_iso,
    monthly_price_usd,
    amount: data.amount,
    customer: data.customer,
  });

  if (!user_id || !phone_number || !country_iso) {
    console.warn("[elgiopay-webhook] missing metadata on payment.completed:", meta);
    return;
  }

  const admin = await getAdmin();

  // Idempotency: reuse stripe_checkout_session_id to store the ElgioPay tx id
  const { data: existing } = await admin
    .from("phone_subscriptions" as any)
    .select("id")
    .eq("stripe_checkout_session_id", txId)
    .maybeSingle();
  if (existing) {
    console.log("[elgiopay-webhook] already processed, skipping:", txId);
    return;
  }

  // Provision the Twilio number
  console.info("[elgiopay-webhook] purchasing Twilio number:", phone_number);
  const { purchasePhoneNumber } = await import("@/lib/twilio.server");
  let twilioSid: string;
  let provisionedNumber: string;
  try {
    const result = await purchasePhoneNumber(phone_number);
    twilioSid = result.sid;
    provisionedNumber = result.phoneNumber;
    console.info("[elgiopay-webhook] Twilio number purchased:", { twilioSid, provisionedNumber });
  } catch (e) {
    console.error("[elgiopay-webhook] Twilio purchase failed:", e);
    throw e;
  }

  // Insert phone_allocation (TWILIO provider)
  console.info("[elgiopay-webhook] inserting phone_allocation for user:", user_id);
  const { data: allocation, error: allocErr } = await admin
    .from("phone_allocations")
    .insert({
      user_id,
      e164: provisionedNumber,
      country_iso,
      provider: "TWILIO",
      status: "ACTIVE",
      twilio_sid: twilioSid,
    } as any)
    .select()
    .single();
  if (allocErr) {
    console.error("[elgiopay-webhook] phone_allocation insert error:", allocErr);
    throw new Error(allocErr.message);
  }
  console.info("[elgiopay-webhook] phone_allocation created:", allocation.id);

  // Insert phone_subscription
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  console.info("[elgiopay-webhook] inserting phone_subscription", { txId, periodEnd });
  await admin.from("phone_subscriptions" as any).insert({
    user_id,
    phone_allocation_id: allocation.id,
    stripe_subscription_id: txId,
    stripe_customer_id: data.customer?.phone ?? "",
    stripe_checkout_session_id: txId,
    status: "ACTIVE",
    phone_number: provisionedNumber,
    country_iso,
    twilio_sid: twilioSid,
    monthly_price_usd: parseFloat(monthly_price_usd ?? "6"),
    current_period_end: periodEnd,
  });

  // Update profile
  console.info("[elgiopay-webhook] updating profile allocated_phone_number for user:", user_id);
  await admin
    .from("profiles")
    .update({
      allocated_phone_number: provisionedNumber,
      phone_onboarding_completed: true,
    } as any)
    .eq("id", user_id);

  console.info(`[elgiopay-webhook] ✓ fully provisioned ${provisionedNumber} for user ${user_id}`);
}

async function handlePaymentFailed(data: any) {
  const meta: Record<string, string> = data.metadata ?? {};
  console.warn("[elgiopay-webhook] payment.failed for user:", meta.user_id, "tx:", data.transaction_id);
}

export const Route = createFileRoute("/api/public/payments/elgiopay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.ELGIOPAY_WEBHOOK_SECRET) {
          console.error("[elgiopay-webhook] ELGIOPAY_WEBHOOK_SECRET not configured");
          return new Response("Webhook secret not configured", { status: 500 });
        }

        let event: any;
        try {
          event = await verifySignature(request);
        } catch (e) {
          console.error("[elgiopay-webhook] signature verification failed:", e);
          return new Response("Webhook signature invalid", { status: 400 });
        }

        const eventType: string = event.event ?? "";
        const eventId: string =
          request.headers.get("x-elgiopay-event-id") ?? event.id ?? "";

        console.log("[elgiopay-webhook] received:", eventType, eventId);

        try {
          switch (eventType) {
            case "payment.completed":
              await handlePaymentCompleted(event.data);
              break;
            case "payment.failed":
              await handlePaymentFailed(event.data);
              break;
            default:
              console.log("[elgiopay-webhook] unhandled event:", eventType);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("[elgiopay-webhook] handler error:", e);
          return new Response("Webhook handler error", { status: 500 });
        }
      },
    },
  },
});
