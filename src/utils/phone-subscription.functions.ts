import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient } from "@/lib/stripe.server";
import { PHONE_COUNTRIES, monthlyPriceUsd } from "@/lib/phone-countries";

export { PHONE_COUNTRIES, monthlyPriceUsd };

export const searchPhoneNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { countryIso: string; contains?: string }) => {
    if (!PHONE_COUNTRIES[data.countryIso]) throw new Error("Pays non supporté");
    return data;
  })
  .handler(async ({ data }) => {
    console.info("[phone-rent] searchPhoneNumbers start", {
      countryIso: data.countryIso,
      contains: data.contains,
    });
    const { searchAvailableNumbers } = await import("@/lib/twilio.server");
    const results = await searchAvailableNumbers(data.countryIso, data.contains);
    console.info(`[phone-rent] searchPhoneNumbers done → ${results.length} numbers`);
    return results;
  });

export const createPhoneNumberCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { phoneNumber: string; countryIso: string; stripeEnv?: "sandbox" | "live" }) => {
      if (!data.phoneNumber?.trim()) throw new Error("Numéro requis");
      if (!PHONE_COUNTRIES[data.countryIso]) throw new Error("Pays non supporté");
      return { ...data, stripeEnv: (data.stripeEnv ?? "sandbox") as "sandbox" | "live" };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const stripe = createStripeClient(data.stripeEnv);

    const req = getRequest();
    const origin = new URL(req.url).origin;

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, stripe_customer_id" as "first_name, last_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email;

    let customerId: string = (profile as any)?.stripe_customer_id ?? "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || undefined,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId } as any)
        .eq("id", userId);
    }

    const priceUsd = monthlyPriceUsd(data.countryIso);
    const countryName = PHONE_COUNTRIES[data.countryIso]?.name ?? data.countryIso;

    const product = await stripe.products.create({
      name: `Numéro AfriFlow · ${data.phoneNumber}`,
      description: `Location mensuelle · ${countryName}`,
      metadata: { type: "phone_rental", country_iso: data.countryIso },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(priceUsd * 100),
      currency: "usd",
      recurring: { interval: "month" },
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        user_id: userId,
        phone_number: data.phoneNumber,
        country_iso: data.countryIso,
        monthly_price_usd: priceUsd.toString(),
        stripe_env: data.stripeEnv,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          phone_number: data.phoneNumber,
          country_iso: data.countryIso,
          stripe_env: data.stripeEnv,
        },
      },
      success_url: `${origin}/onboarding/phone?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/onboarding/phone`,
    });

    if (!session.url) throw new Error("Impossible de créer la session de paiement");
    return { url: session.url };
  });

export const getMyPhoneSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("phone_subscriptions" as any)
      .select("*")
      .eq("user_id", userId)
      .in("status", ["ACTIVE", "PENDING", "PAST_DUE"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { subscription: data as any };
  });

export const dismissPhoneOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("profiles")
      .update({ phone_onboarding_completed: true } as any)
      .eq("id", userId);
    return { ok: true };
  });

export const createElgioPayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      phoneNumber: string;
      countryIso: string;
      momoPhone: string;
      paymentMethod: "mtn_mobile_money" | "orange_money";
    }) => {
      if (!data.phoneNumber?.trim()) throw new Error("Numéro requis");
      if (!PHONE_COUNTRIES[data.countryIso]) throw new Error("Pays non supporté");
      if (!data.momoPhone?.trim()) throw new Error("Numéro Mobile Money requis");
      if (!["mtn_mobile_money", "orange_money"].includes(data.paymentMethod))
        throw new Error("Méthode de paiement invalide");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    console.info("[phone-rent] createElgioPayPayment start", {
      userId,
      phoneNumber: data.phoneNumber,
      countryIso: data.countryIso,
      paymentMethod: data.paymentMethod,
      momoPhone: data.momoPhone,
    });

    const [{ data: profile }, { data: authData }] = await Promise.all([
      supabase.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle(),
      supabase.auth.getUser(),
    ]);

    const priceUsd = monthlyPriceUsd(data.countryIso);
    console.info("[phone-rent] price", { priceUsd, countryIso: data.countryIso });

    const { initiatePayment, detectCurrency, usdToLocal } = await import("@/lib/elgiopay.server");

    const currency = detectCurrency(data.momoPhone);
    const amount = usdToLocal(priceUsd, currency);
    console.info("[phone-rent] currency detection", {
      momoPhone: data.momoPhone,
      currency,
      amount,
    });

    const customerName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || undefined;
    const reference = `phone-rent-${userId.slice(0, 8)}-${Date.now()}`;

    const payload = {
      amount,
      currency,
      payment_method: data.paymentMethod,
      customer_phone: data.momoPhone,
      customer_name: customerName,
      customer_email: authData?.user?.email ?? undefined,
      reference,
      metadata: {
        user_id: userId,
        phone_number: data.phoneNumber,
        country_iso: data.countryIso,
        monthly_price_usd: String(priceUsd),
      },
    };
    console.info("[phone-rent] initiatePayment payload", payload);

    const result = await initiatePayment(payload);
    console.info("[phone-rent] initiatePayment result", result);

    return { transactionId: result.transaction_id, status: result.status };
  });

export const pollElgioPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string }) => {
    if (!data.transactionId?.trim()) throw new Error("Transaction ID requis");
    return data;
  })
  .handler(async ({ data }) => {
    console.info("[phone-rent] pollElgioPayment", { transactionId: data.transactionId });
    const { getPaymentStatus } = await import("@/lib/elgiopay.server");
    const result = await getPaymentStatus(data.transactionId);
    console.info("[phone-rent] pollElgioPayment result", {
      transactionId: result.transaction_id,
      status: result.status,
      amount: result.amount,
      updatedAt: result.updated_at,
      completedAt: result.completed_at,
    });
    return { status: result.status, transactionId: result.transaction_id };
  });

/**
 * Provisions the Twilio number and records the subscription directly from the
 * client, after polling detects a completed payment. This is the primary path
 * in sandbox (webhook never reaches localhost) and a safe fallback in production
 * — the idempotency check on stripe_checkout_session_id prevents double provisioning.
 */
export const finalizePhoneProvisioning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      transactionId: string;
      phoneNumber: string;
      countryIso: string;
      monthlyPriceUsd: number;
      customerPhone: string;
    }) => {
      if (!d.transactionId?.trim()) throw new Error("transactionId requis");
      if (!d.phoneNumber?.trim()) throw new Error("phoneNumber requis");
      if (!PHONE_COUNTRIES[d.countryIso]) throw new Error("Pays non supporté");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    console.info("[phone-rent] finalizePhoneProvisioning start", {
      userId,
      transactionId: data.transactionId,
      phoneNumber: data.phoneNumber,
      countryIso: data.countryIso,
    });

    // Guard: only proceed if ElgioPay confirms payment is completed
    const { getPaymentStatus } = await import("@/lib/elgiopay.server");
    const payment = await getPaymentStatus(data.transactionId);
    console.info("[phone-rent] finalizePhoneProvisioning payment status:", payment.status);
    if (payment.status !== "completed") {
      throw new Error(`Paiement non complété (statut actuel : ${payment.status})`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: bail out if already provisioned for this transaction
    const { data: existing } = await supabaseAdmin
      .from("phone_subscriptions" as any)
      .select("id, phone_number")
      .eq("stripe_checkout_session_id", data.transactionId)
      .maybeSingle();
    if (existing) {
      console.info("[phone-rent] finalizePhoneProvisioning: already provisioned", existing);
      return { ok: true, alreadyProvisioned: true };
    }

    // Purchase the Twilio number (voice webhook is set from the request origin)
    const { purchasePhoneNumber } = await import("@/lib/twilio.server");
    const origin = new URL(getRequest().url).origin;
    const { sid: twilioSid, phoneNumber: provisionedNumber } = await purchasePhoneNumber(
      data.phoneNumber,
      origin,
    );
    console.info("[phone-rent] finalizePhoneProvisioning: Twilio purchased", {
      twilioSid,
      provisionedNumber,
    });

    // Insert phone_allocation
    const { data: allocation, error: allocErr } = await supabaseAdmin
      .from("phone_allocations")
      .insert({
        user_id: userId,
        e164: provisionedNumber,
        country_iso: data.countryIso,
        provider: "TWILIO",
        status: "ACTIVE",
        twilio_sid: twilioSid,
      } as any)
      .select()
      .single();
    if (allocErr) throw new Error(allocErr.message);

    // Insert phone_subscription
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from("phone_subscriptions" as any).insert({
      user_id: userId,
      phone_allocation_id: allocation.id,
      stripe_subscription_id: data.transactionId,
      stripe_customer_id: data.customerPhone,
      stripe_checkout_session_id: data.transactionId,
      status: "ACTIVE",
      phone_number: provisionedNumber,
      country_iso: data.countryIso,
      twilio_sid: twilioSid,
      monthly_price_usd: data.monthlyPriceUsd,
      current_period_end: periodEnd,
    });

    // Update profile
    await supabaseAdmin
      .from("profiles")
      .update({
        allocated_phone_number: provisionedNumber,
        phone_onboarding_completed: true,
      } as any)
      .eq("id", userId);

    console.info(
      `[phone-rent] finalizePhoneProvisioning: ✓ provisioned ${provisionedNumber} for user ${userId}`,
    );
    return { ok: true, alreadyProvisioned: false };
  });

/**
 * Allocate a phone number during onboarding.
 * Waitlist (premium) members: the Twilio number is purchased immediately.
 * Everyone else: the number is only RESERVED — Twilio purchase happens when
 * they subscribe to Pro, so transient users never cost us Twilio rental fees.
 */
export const freeAllocatePhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { phoneNumber: string; countryIso: string }) => {
    if (!d.phoneNumber?.trim()) throw new Error("Numéro requis");
    if (!PHONE_COUNTRIES[d.countryIso]) throw new Error("Pays non supporté");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: bail if already allocated or reserved
    const { data: existing } = await supabaseAdmin
      .from("phone_allocations")
      .select("id, e164, status")
      .eq("user_id", userId)
      .in("status", ["ACTIVE", "RESERVED"])
      .maybeSingle();
    if (existing) {
      const row = existing as { id: string; e164: string; status: string };
      console.info("[free-alloc] already allocated/reserved:", row.e164, row.status);
      await supabaseAdmin
        .from("profiles")
        .update({ allocated_phone_number: row.e164, phone_onboarding_completed: true } as any)
        .eq("id", userId);
      return {
        ok: true,
        alreadyProvisioned: true,
        reserved: row.status === "RESERVED",
        phoneNumber: row.e164,
      };
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("is_premium" as "id")
      .eq("id", userId)
      .maybeSingle();
    const isPremium = (profileRow as { is_premium: boolean } | null)?.is_premium ?? false;

    if (!isPremium) {
      // Reserve only — no Twilio purchase until the user subscribes to Pro.
      const { error } = await supabaseAdmin.from("phone_allocations").insert({
        user_id: userId,
        e164: data.phoneNumber,
        country_iso: data.countryIso,
        provider: "TWILIO",
        status: "RESERVED",
        twilio_sid: null,
      } as any);
      if (error) throw new Error(error.message);

      await supabaseAdmin
        .from("profiles")
        .update({
          allocated_phone_number: data.phoneNumber,
          phone_onboarding_completed: true,
        } as any)
        .eq("id", userId);

      console.info(
        `[free-alloc] ✓ reserved ${data.phoneNumber} for user ${userId} (no Twilio purchase)`,
      );
      return { ok: true, alreadyProvisioned: false, reserved: true, phoneNumber: data.phoneNumber };
    }

    const { purchasePhoneNumber } = await import("@/lib/twilio.server");
    const origin = new URL(getRequest().url).origin;
    const { sid: twilioSid, phoneNumber: provisionedNumber } = await purchasePhoneNumber(
      data.phoneNumber,
      origin,
    );
    console.info("[free-alloc] Twilio purchased", { twilioSid, provisionedNumber });

    await supabaseAdmin.from("phone_allocations").insert({
      user_id: userId,
      e164: provisionedNumber,
      country_iso: data.countryIso,
      provider: "TWILIO",
      status: "ACTIVE",
      twilio_sid: twilioSid,
    } as any);

    await supabaseAdmin
      .from("profiles")
      .update({
        allocated_phone_number: provisionedNumber,
        phone_onboarding_completed: true,
      } as any)
      .eq("id", userId);

    console.info(`[free-alloc] ✓ provisioned ${provisionedNumber} for user ${userId}`);
    return { ok: true, alreadyProvisioned: false, reserved: false, phoneNumber: provisionedNumber };
  });
