import { createFileRoute } from "@tanstack/react-router";

type StripeEnv = "sandbox" | "live";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not configured`);
  return v;
}

function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox"
    ? getEnv("STRIPE_SANDBOX_API_KEY")
    : getEnv("STRIPE_LIVE_API_KEY");
}

async function verifyStripeSignature(
  req: Request,
  secret: string,
): Promise<any> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Sigs: string[] = [];
  for (const part of signature.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v;
    if (k === "v1") v1Sigs.push(v);
  }
  if (!timestamp || v1Sigs.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

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
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Buffer.from(new Uint8Array(signed)).toString("hex");
  if (!v1Sigs.includes(expected)) throw new Error("Invalid webhook signature");
  return JSON.parse(body);
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getStripe(env: StripeEnv) {
  const { createStripeClient } = await import("@/lib/stripe.server");
  return createStripeClient(env);
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const { user_id, phone_number, country_iso, monthly_price_usd } =
    session.metadata ?? {};
  if (!user_id || !phone_number || !country_iso) {
    console.warn("[phone-webhook] checkout.session.completed missing metadata");
    return;
  }

  const admin = await getAdmin();

  // Idempotency check
  const { data: existing } = await admin
    .from("phone_subscriptions" as any)
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (existing) {
    console.log("[phone-webhook] session already processed:", session.id);
    return;
  }

  // Provision the Twilio number
  const { purchasePhoneNumber } = await import("@/lib/twilio.server");
  let twilioSid: string;
  let provisionedNumber: string;
  try {
    const result = await purchasePhoneNumber(phone_number);
    twilioSid = result.sid;
    provisionedNumber = result.phoneNumber;
  } catch (e) {
    console.error("[phone-webhook] Twilio purchase failed:", e);
    throw e;
  }

  // Insert phone_allocation (provider: TWILIO)
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
    console.error("[phone-webhook] allocation insert failed:", allocErr);
    throw new Error(allocErr.message);
  }

  // Insert phone_subscription
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? "";
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? "";

  // Get subscription period end
  let periodEnd: string | null = null;
  try {
    const stripe = await getStripe(env);
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    periodEnd = new Date((sub as any).current_period_end * 1000).toISOString();
  } catch {}

  await admin.from("phone_subscriptions" as any).insert({
    user_id,
    phone_allocation_id: allocation.id,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    stripe_checkout_session_id: session.id,
    status: "ACTIVE",
    phone_number: provisionedNumber,
    country_iso,
    twilio_sid: twilioSid,
    monthly_price_usd: parseFloat(monthly_price_usd ?? "6"),
    current_period_end: periodEnd,
  });

  // Update profile
  await admin
    .from("profiles")
    .update({
      allocated_phone_number: provisionedNumber,
      phone_onboarding_completed: true,
    } as any)
    .eq("id", user_id);

  console.log(`[phone-webhook] provisioned ${provisionedNumber} for user ${user_id}`);
}

async function handleSubscriptionDeleted(subscription: any) {
  const admin = await getAdmin();

  const { data: phoneSub } = await admin
    .from("phone_subscriptions" as any)
    .select("*")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (!phoneSub) {
    console.warn("[phone-webhook] no phone_subscription for:", subscription.id);
    return;
  }

  // Release Twilio number
  if ((phoneSub as any).twilio_sid) {
    try {
      const { releasePhoneNumber } = await import("@/lib/twilio.server");
      await releasePhoneNumber((phoneSub as any).twilio_sid);
    } catch (e) {
      console.error("[phone-webhook] Twilio release failed:", e);
    }
  }

  // Update phone_allocation status
  if ((phoneSub as any).phone_allocation_id) {
    await admin
      .from("phone_allocations")
      .update({ status: "RELEASED" } as any)
      .eq("id", (phoneSub as any).phone_allocation_id);
  }

  // Update phone_subscription status
  await admin
    .from("phone_subscriptions" as any)
    .update({ status: "CANCELLED" } as any)
    .eq("id", (phoneSub as any).id);

  // Clear profile allocated number
  if ((phoneSub as any).user_id) {
    await admin
      .from("profiles")
      .update({ allocated_phone_number: null } as any)
      .eq("id", (phoneSub as any).user_id)
      .eq("allocated_phone_number", (phoneSub as any).phone_number);
  }

  console.log(`[phone-webhook] released ${(phoneSub as any).phone_number}`);
}

async function handlePaymentFailed(invoice: any) {
  const subId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? "";
  if (!subId) return;

  const admin = await getAdmin();
  await admin
    .from("phone_subscriptions" as any)
    .update({ status: "PAST_DUE" } as any)
    .eq("stripe_subscription_id", subId)
    .eq("status", "ACTIVE");

  console.log("[phone-webhook] marked PAST_DUE for subscription:", subId);
}

async function handleSubscriptionUpdated(subscription: any) {
  const admin = await getAdmin();
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  await admin
    .from("phone_subscriptions" as any)
    .update({
      status: subscription.status === "active" ? "ACTIVE" : "PAST_DUE",
      current_period_end: periodEnd,
    } as any)
    .eq("stripe_subscription_id", subscription.id);
}

export const Route = createFileRoute("/api/public/payments/phone-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env = rawEnv as StripeEnv;

        const secret =
          env === "sandbox"
            ? process.env.STRIPE_PHONE_SANDBOX_WEBHOOK_SECRET
            : process.env.STRIPE_PHONE_LIVE_WEBHOOK_SECRET;

        if (!secret) {
          console.error("[phone-webhook] webhook secret not configured for env:", env);
          return new Response("Webhook secret not configured", { status: 500 });
        }

        let event: any;
        try {
          event = await verifyStripeSignature(request, secret);
        } catch (e) {
          console.error("[phone-webhook] signature verification failed:", e);
          return new Response("Webhook signature invalid", { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed":
              if (event.data.object.mode === "subscription") {
                await handleCheckoutCompleted(event.data.object, env);
              }
              break;
            case "customer.subscription.deleted":
              await handleSubscriptionDeleted(event.data.object);
              break;
            case "customer.subscription.updated":
              await handleSubscriptionUpdated(event.data.object);
              break;
            case "invoice.payment_failed":
              await handlePaymentFailed(event.data.object);
              break;
            default:
              console.log("[phone-webhook] unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("[phone-webhook] handler error:", e);
          return new Response("Webhook handler error", { status: 500 });
        }
      },
    },
  },
});
