import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import proPlanConfigJson from "@/data/pro-plan-config.json";

type ProPlanConfig = {
  priceEur: number;
  cycleDays: number;
  includedMinutes: number;
  trialMinutes: number;
};

function loadProPlanConfig(): ProPlanConfig {
  return proPlanConfigJson as ProPlanConfig;
}

/**
 * Waitlist (premium) members consume their trial minutes before subscribing, so
 * going Pro resets them to includedMinutes. Non-waitlist members never had a
 * trial: their trial minutes are granted on top when they subscribe (150+10=160).
 */
function computeIncludedMinutes(config: ProPlanConfig, isPremium: boolean): number {
  return config.includedMinutes + (isPremium ? 0 : config.trialMinutes);
}

async function fireAndForgetEmail(
  args: Parameters<typeof import("@/lib/email/send.server").sendAppEmail>[0],
) {
  try {
    const { sendAppEmail } = await import("@/lib/email/send.server");
    const res = await sendAppEmail(args);
    if (!res.ok) console.warn("[email] not sent", args.templateName, res.reason);
  } catch (e) {
    console.error("[email] error", args.templateName, e);
  }
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Top-up packs (minutes -> FCFA). Other currencies converted client-side via fx. */
export const TOPUP_PACKS = [
  { minutes: 50, priceXof: 2000 },
  { minutes: 100, priceXof: 4000 },
  { minutes: 200, priceXof: 8000 },
] as const;

const TRIAL_DAYS = 7;

type Wallet = any;

/** Apply lazy state transitions (trial expired → restricted, cycle expired → reset/restrict). */
async function reconcileWallet(admin: any, wallet: Wallet): Promise<Wallet> {
  const now = Date.now();
  let next: Partial<Wallet> | null = null;

  if (
    wallet.plan_status === "TRIAL" &&
    wallet.trial_ends_at &&
    new Date(wallet.trial_ends_at).getTime() <= now
  ) {
    next = { plan_status: "RESTRICTED", plan_name: "TRIAL_EXPIRED" };
  } else if (
    wallet.plan_status === "ACTIVE" &&
    wallet.cycle_ends_at &&
    new Date(wallet.cycle_ends_at).getTime() <= now
  ) {
    next = { plan_status: "RESTRICTED", included_used_seconds: wallet.included_minutes * 60 };
  }

  if (!next) return wallet;
  const { data, error } = await admin
    .from("phone_wallets")
    .update(next)
    .eq("user_id", wallet.user_id)
    .select()
    .single();
  if (error) return wallet;
  return data as Wallet;
}

export const getPhoneWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const admin = await getAdmin();
    const config = loadProPlanConfig();

    const [{ data: walletRow }, { data: profileRow }] = await Promise.all([
      supabase.from("phone_wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("profiles")
        .select("is_premium" as "id")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    let wallet = walletRow;
    const isPremium = (profileRow as { is_premium: boolean } | null)?.is_premium ?? false;

    if (!wallet) {
      // Waitlist (premium) members start with a free trial; everyone else must
      // subscribe to Pro before getting any call minutes.
      const ins = await admin
        .from("phone_wallets")
        .insert(
          isPremium
            ? {
                user_id: userId,
                plan_status: "TRIAL",
                plan_name: "TRIAL",
                included_minutes: config.trialMinutes,
                included_used_seconds: 0,
                extra_seconds: 0,
                trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000).toISOString(),
              }
            : {
                // The trial minutes are visible in the balance but unusable
                // until the user subscribes to Pro (NO_PLAN → calls blocked).
                user_id: userId,
                plan_status: "RESTRICTED",
                plan_name: "NO_PLAN",
                included_minutes: config.trialMinutes,
                included_used_seconds: 0,
                extra_seconds: 0,
                trial_ends_at: null,
              },
        )
        .select()
        .single();
      wallet = ins.data as any;
      if (wallet && isPremium) {
        await admin.from("minute_transactions").insert({
          user_id: userId,
          kind: "TRIAL_GRANT",
          bucket: "INCLUDED",
          minutes_delta: config.trialMinutes,
          reference: "Essai découverte 7 jours (early access)",
        });
      }
    } else if ((wallet as any).plan_name === "NO_PLAN" && isPremium) {
      // The waitlist premium grant runs fire-and-forget at signup and may land
      // after the wallet was created — upgrade to the trial they were owed.
      const { data: priorGrant } = await admin
        .from("minute_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("kind", "TRIAL_GRANT")
        .maybeSingle();
      if (!priorGrant) {
        const upd = await admin
          .from("phone_wallets")
          .update({
            plan_status: "TRIAL",
            plan_name: "TRIAL",
            included_minutes: config.trialMinutes,
            included_used_seconds: 0,
            trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000).toISOString(),
          })
          .eq("user_id", userId)
          .select()
          .single();
        if (upd.data) {
          wallet = upd.data as any;
          await admin.from("minute_transactions").insert({
            user_id: userId,
            kind: "TRIAL_GRANT",
            bucket: "INCLUDED",
            minutes_delta: config.trialMinutes,
            reference: "Essai découverte 7 jours (early access)",
          });
        }
      }
    } else if (!isPremium) {
      const w = wallet as {
        plan_name: string;
        included_minutes: number;
        included_used_seconds: number;
      };
      if (["TRIAL", "TRIAL_EXPIRED"].includes(w.plan_name)) {
        // Legacy trial wallet created before trials became waitlist-only: the
        // minutes stay visible in the balance but are locked until Pro.
        const upd = await admin
          .from("phone_wallets")
          .update({ plan_status: "RESTRICTED", plan_name: "NO_PLAN", trial_ends_at: null })
          .eq("user_id", userId)
          .select()
          .single();
        if (upd.data) wallet = upd.data as typeof walletRow;
      } else if (w.plan_name === "NO_PLAN" && w.included_minutes === 0) {
        // Wallets zeroed by the earlier revocation logic: show the offered
        // trial minutes again (still locked until Pro).
        const upd = await admin
          .from("phone_wallets")
          .update({ included_minutes: config.trialMinutes, included_used_seconds: 0 })
          .eq("user_id", userId)
          .select()
          .single();
        if (upd.data) wallet = upd.data as typeof walletRow;
      }
    }

    if (!wallet) throw new Error("Impossible de charger le wallet téléphonie.");
    wallet = await reconcileWallet(admin, wallet as Wallet);

    const includedCapSec = (wallet as any).included_minutes * 60;
    const includedRemSec = Math.max(0, includedCapSec - (wallet as any).included_used_seconds);
    const extraSec = (wallet as any).extra_seconds;

    return {
      wallet,
      includedMinutesRemaining: Math.floor(includedRemSec / 60),
      includedSecondsRemaining: includedRemSec,
      extraMinutesRemaining: Math.floor(extraSec / 60),
      extraSecondsRemaining: extraSec,
      totalSecondsRemaining: includedRemSec + extraSec,
      totalMinutesRemaining: Math.floor((includedRemSec + extraSec) / 60),
      isTrial: (wallet as any).plan_status === "TRIAL",
      isRestricted: (wallet as any).plan_status === "RESTRICTED",
      isActive: (wallet as any).plan_status === "ACTIVE",
      // Never had a plan (non-waitlist account): must subscribe to Pro to unlock minutes.
      needsPro: (wallet as any).plan_name === "NO_PLAN",
      trialDaysRemaining:
        (wallet as any).plan_status === "TRIAL" && (wallet as any).trial_ends_at
          ? Math.max(
              0,
              Math.ceil(
                (new Date((wallet as any).trial_ends_at).getTime() - Date.now()) /
                  (24 * 3600 * 1000),
              ),
            )
          : null,
    };
  });

export const listMinuteTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("minute_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

/** Consume call seconds — included first, then extra. */
export const consumeCallMinutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { seconds: number; callLogId?: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const admin = await getAdmin();
    const seconds = Math.max(0, Math.floor(data.seconds));
    if (seconds === 0) return { debitedSeconds: 0 };

    const { data: w } = await admin
      .from("phone_wallets")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (!w) throw new Error("Wallet introuvable");

    const includedCapSec = (w as any).included_minutes * 60;
    const includedRem = Math.max(0, includedCapSec - (w as any).included_used_seconds);
    const fromIncluded = Math.min(seconds, includedRem);
    const remainAfterIncluded = seconds - fromIncluded;
    const fromExtra = Math.min(remainAfterIncluded, (w as any).extra_seconds);
    const totalDebited = fromIncluded + fromExtra;

    await admin
      .from("phone_wallets")
      .update({
        included_used_seconds: (w as any).included_used_seconds + fromIncluded,
        extra_seconds: (w as any).extra_seconds - fromExtra,
      })
      .eq("user_id", userId);

    await admin.from("minute_transactions").insert({
      user_id: userId,
      kind: "CALL_DEBIT",
      bucket: fromIncluded && fromExtra ? "MIXED" : fromExtra ? "EXTRA" : "INCLUDED",
      minutes_delta: -Math.round((totalDebited / 60) * 100) / 100,
      reference: data.callLogId ?? null,
      metadata: { fromIncludedSec: fromIncluded, fromExtraSec: fromExtra, requestedSec: seconds },
    });

    return { debitedSeconds: totalDebited, fromIncluded, fromExtra };
  });

/** Simulated Mobile Money top-up: instantly credits extra minutes. */
export const purchaseTopUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { minutes: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await getAdmin();
    const minutes = Math.floor(data.minutes);
    if (minutes < 10 || minutes > 5000) throw new Error("Quantité invalide (10–5000 min).");

    const { data: w } = await admin
      .from("phone_wallets")
      .select("extra_seconds, plan_status, plan_name")
      .eq("user_id", userId)
      .single();
    if (!w) throw new Error("Wallet introuvable");

    // Top-ups are reserved for subscribers with a running Pro cycle.
    const status = w as { plan_status: string; plan_name: string };
    if (status.plan_status !== "ACTIVE" || status.plan_name !== "PRO")
      throw new Error(
        "La recharge de minutes est réservée aux abonnés Pro pendant leur cycle d'abonnement.",
      );

    await new Promise((r) => setTimeout(r, 600));

    const newExtra = (w as any).extra_seconds + minutes * 60;
    await admin.from("phone_wallets").update({ extra_seconds: newExtra }).eq("user_id", userId);

    const ref = `TOPUP-${Date.now().toString(36).toUpperCase()}`;
    await admin.from("minute_transactions").insert({
      user_id: userId,
      kind: "TOPUP",
      bucket: "EXTRA",
      minutes_delta: minutes,
      reference: ref,
      metadata: { simulated: true },
    });

    const email = (context.claims as any)?.email as string | undefined;
    if (email) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", userId)
        .maybeSingle();
      void fireAndForgetEmail({
        templateName: "topup-receipt",
        recipientEmail: email,
        idempotencyKey: `topup-${ref}`,
        templateData: { firstName: (prof as any)?.first_name, minutes, reference: ref },
      });
    }

    return { ok: true, reference: ref, creditedMinutes: minutes };
  });

/** Simulated Pro plan subscription / renewal. Resets included minutes. */
export const subscribePro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const admin = await getAdmin();
    const config = loadProPlanConfig();
    await new Promise((r) => setTimeout(r, 500));

    const { data: prof } = await supabase
      .from("profiles")
      .select("first_name, is_premium" as "id")
      .eq("id", userId)
      .maybeSingle();
    const profile = prof as { first_name: string | null; is_premium: boolean } | null;
    const isPremium = profile?.is_premium ?? false;
    const includedMinutes = computeIncludedMinutes(config, isPremium);

    const cycleEnd = new Date(Date.now() + config.cycleDays * 24 * 3600 * 1000).toISOString();
    const { error } = await admin.from("phone_wallets").upsert(
      {
        user_id: userId,
        plan_status: "ACTIVE",
        plan_name: "PRO",
        included_minutes: includedMinutes,
        included_used_seconds: 0,
        cycle_ends_at: cycleEnd,
        last_reset_at: new Date().toISOString(),
        trial_ends_at: null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    // Buy the reserved Twilio number now that the plan is active (non-waitlist flow).
    const origin = new URL(getRequest().url).origin;
    await activateReservedAllocation(admin, userId, origin);

    await admin.from("minute_transactions").insert({
      user_id: userId,
      kind: "PLAN_SUBSCRIBE",
      bucket: "INCLUDED",
      minutes_delta: includedMinutes,
      reference: `PRO-${Date.now().toString(36).toUpperCase()}`,
      metadata: { plan: "PRO", cycleDays: config.cycleDays, simulated: true },
    });

    const email = (context.claims as any)?.email as string | undefined;
    if (email) {
      void fireAndForgetEmail({
        templateName: "pro-activated",
        recipientEmail: email,
        idempotencyKey: `pro-activated-${userId}-${cycleEnd}`,
        templateData: { firstName: profile?.first_name, includedMinutes, cycleEnd },
      });
    }

    try {
      const { pushNotification } = await import("@/lib/notifications.server");
      await pushNotification(admin, {
        userId,
        kind: "PRO_ACTIVATED",
        title: "Plan Pro activé",
        body: `${includedMinutes} minutes incluses · cycle de ${config.cycleDays} jours.`,
        linkTo: "/dashboard",
      });
    } catch (e) {
      console.error("[notifications] pro", e);
    }

    return { ok: true, cycleEnd };
  });

// ─── Pro Plan via ElgioPay ────────────────────────────────────────────────────

type ProfileOfferRow = { is_premium: boolean };
type ProfileInitiateRow = {
  kyc_status: string;
  first_name: string | null;
  last_name: string | null;
};
type ProfileFinalizeRow = { is_premium: boolean; first_name: string | null };
type AllocationRow = { id: string; country_iso: string; e164: string; twilio_sid: string | null };

/**
 * Purchase on Twilio the number a non-waitlist user reserved during onboarding,
 * then flip the allocation to ACTIVE. If the reserved number was taken in the
 * meantime, buy the closest available number in the same country. Returns the
 * activated allocation, or null if nothing was reserved / purchase failed
 * (the allocation then stays RESERVED for a later retry).
 */
async function activateReservedAllocation(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  userId: string,
  origin: string | null,
): Promise<AllocationRow | null> {
  const { data } = await admin
    .from("phone_allocations")
    .select("id, country_iso, e164, twilio_sid")
    .eq("user_id", userId)
    .eq("status", "RESERVED")
    .maybeSingle();
  const reserved = data as AllocationRow | null;
  if (!reserved) return null;

  const { purchasePhoneNumber, searchAvailableNumbers } = await import("@/lib/twilio.server");
  let purchased: { sid: string; phoneNumber: string } | null = null;
  try {
    purchased = await purchasePhoneNumber(reserved.e164, origin);
  } catch (e) {
    console.warn(
      `[pro-sub] reserved number ${reserved.e164} no longer available, searching a replacement:`,
      (e as Error).message,
    );
    try {
      const candidates = await searchAvailableNumbers(reserved.country_iso);
      if (candidates.length > 0)
        purchased = await purchasePhoneNumber(candidates[0].phoneNumber, origin);
    } catch (e2) {
      console.error("[pro-sub] replacement number purchase failed:", (e2 as Error).message);
    }
  }
  if (!purchased) {
    console.error(
      `[pro-sub] ⚠ could not activate reserved number for user ${userId} — allocation kept RESERVED`,
    );
    return null;
  }

  const { data: updated } = await admin
    .from("phone_allocations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ e164: purchased.phoneNumber, twilio_sid: purchased.sid, status: "ACTIVE" } as any)
    .eq("id", reserved.id)
    .select("id, country_iso, e164, twilio_sid")
    .single();
  await admin
    .from("profiles")
    .update({ allocated_phone_number: purchased.phoneNumber })
    .eq("id", userId);
  console.info(`[pro-sub] ✓ activated reserved number ${purchased.phoneNumber} for user ${userId}`);
  return (
    (updated as AllocationRow | null) ?? {
      ...reserved,
      e164: purchased.phoneNumber,
      twilio_sid: purchased.sid,
    }
  );
}

export const getProPlanOffer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const config = loadProPlanConfig();

    const [{ data: profileData }, { data: allocData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_premium" as "id")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("phone_allocations")
        .select("country_iso")
        .eq("user_id", userId)
        .in("status", ["ACTIVE", "RESERVED"])
        .maybeSingle(),
    ]);

    const isPremium = (profileData as ProfileOfferRow | null)?.is_premium ?? false;
    const phoneCountryIso = (allocData as { country_iso: string } | null)?.country_iso ?? null;

    return {
      priceEur: config.priceEur,
      cycleDays: config.cycleDays,
      standardMinutes: config.includedMinutes,
      trialMinutes: config.trialMinutes,
      includedMinutes: computeIncludedMinutes(config, isPremium),
      isPremium,
      phoneCountryIso,
      hasPhoneNumber: phoneCountryIso !== null,
    };
  });

export const initiateProSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { momoPhone: string; paymentMethod: "mtn_mobile_money" | "orange_money" }) => {
      if (!d.momoPhone?.trim()) throw new Error("Numéro Mobile Money requis");
      if (!["mtn_mobile_money", "orange_money"].includes(d.paymentMethod))
        throw new Error("Méthode de paiement invalide");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("kyc_status, first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    const profile = profileData as ProfileInitiateRow | null;

    if (profile?.kyc_status !== "APPROVED")
      throw new Error("Vous devez compléter la vérification KYC avant de souscrire au plan Pro.");

    const { data: allocData } = await supabase
      .from("phone_allocations")
      .select("e164")
      .eq("user_id", userId)
      .in("status", ["ACTIVE", "RESERVED"])
      .maybeSingle();
    if (!allocData)
      throw new Error(
        "Aucun numéro de téléphone trouvé. Finalisez d'abord le choix de votre numéro.",
      );

    const config = loadProPlanConfig();
    const { initiatePayment, detectCurrency, eurToLocal } = await import("@/lib/elgiopay.server");
    const { data: authData } = await supabase.auth.getUser();

    const currency = detectCurrency(data.momoPhone);
    const amount = eurToLocal(config.priceEur, currency);
    const customerName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || undefined;

    const result = await initiatePayment({
      amount,
      currency,
      payment_method: data.paymentMethod,
      customer_phone: data.momoPhone,
      customer_name: customerName,
      customer_email: authData?.user?.email ?? undefined,
      reference: `pro-sub-${userId.slice(0, 8)}-${Date.now()}`,
      metadata: { user_id: userId, plan: "PRO", price_eur: String(config.priceEur) },
    });

    return { transactionId: result.transaction_id, status: result.status };
  });

export const pollProPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { transactionId: string }) => {
    if (!d.transactionId?.trim()) throw new Error("Transaction ID requis");
    return d;
  })
  .handler(async ({ data }) => {
    const { getPaymentStatus } = await import("@/lib/elgiopay.server");
    const result = await getPaymentStatus(data.transactionId);
    return { status: result.status, transactionId: result.transaction_id };
  });

export const finalizeProSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { transactionId: string }) => {
    if (!d.transactionId?.trim()) throw new Error("transactionId requis");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { getPaymentStatus } = await import("@/lib/elgiopay.server");
    const payment = await getPaymentStatus(data.transactionId);
    if (payment.status !== "completed")
      throw new Error(`Paiement non complété (statut : ${payment.status})`);

    const admin = await getAdmin();

    // Idempotency: bail if already activated for this transaction
    const { data: existing } = await admin
      .from("minute_transactions")
      .select("id")
      .eq("reference", `PRO-TX-${data.transactionId}`)
      .maybeSingle();
    if (existing) return { ok: true, alreadyActivated: true, includedMinutes: null };

    const config = loadProPlanConfig();

    const [{ data: profileData }, { data: allocData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_premium, first_name" as "id")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("phone_allocations")
        .select("id, country_iso, e164, twilio_sid")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .maybeSingle(),
    ]);

    const profile = profileData as ProfileFinalizeRow | null;
    let allocation = allocData as AllocationRow | null;
    const isPremium = profile?.is_premium ?? false;
    const includedMinutes = computeIncludedMinutes(config, isPremium);

    // Non-waitlist users only reserved their number during onboarding: buy it
    // on Twilio now that the Pro plan is paid.
    if (!allocation) {
      const origin = new URL(getRequest().url).origin;
      allocation = await activateReservedAllocation(admin, userId, origin);
    }

    const cycleEnd = new Date(Date.now() + config.cycleDays * 24 * 3600 * 1000).toISOString();

    await admin.from("phone_wallets").upsert(
      {
        user_id: userId,
        plan_status: "ACTIVE",
        plan_name: "PRO",
        included_minutes: includedMinutes,
        included_used_seconds: 0,
        cycle_ends_at: cycleEnd,
        last_reset_at: new Date().toISOString(),
        trial_ends_at: null,
      },
      { onConflict: "user_id" },
    );

    // Activate or renew phone_subscriptions record
    if (allocation) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subTable = admin.from("phone_subscriptions" as any);
      const { data: existingSub } = await subTable.select("id").eq("user_id", userId).maybeSingle();
      const existingSubId = (existingSub as { id: string } | null)?.id ?? null;

      if (existingSubId) {
        await subTable
          .update({
            status: "ACTIVE",
            current_period_end: cycleEnd,
            stripe_checkout_session_id: data.transactionId,
            // Column predates the EUR pricing; stores the plan price in EUR.
            monthly_price_usd: config.priceEur,
          })
          .eq("id", existingSubId);
      } else {
        await subTable.insert({
          user_id: userId,
          phone_allocation_id: allocation.id,
          stripe_subscription_id: data.transactionId,
          stripe_customer_id: "elgiopay",
          stripe_checkout_session_id: data.transactionId,
          status: "ACTIVE",
          phone_number: allocation.e164,
          country_iso: allocation.country_iso,
          twilio_sid: allocation.twilio_sid,
          monthly_price_usd: config.priceEur,
          current_period_end: cycleEnd,
        });
      }
    }

    await admin.from("minute_transactions").insert({
      user_id: userId,
      kind: "PLAN_SUBSCRIBE",
      bucket: "INCLUDED",
      minutes_delta: includedMinutes,
      reference: `PRO-TX-${data.transactionId}`,
      metadata: {
        plan: "PRO",
        cycleDays: config.cycleDays,
        isPremium,
        phoneCountryIso: allocation?.country_iso,
        transactionId: data.transactionId,
      },
    });

    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email;
    if (email) {
      void fireAndForgetEmail({
        templateName: "pro-activated",
        recipientEmail: email,
        idempotencyKey: `pro-tx-${data.transactionId}`,
        templateData: {
          firstName: profile?.first_name,
          includedMinutes,
          cycleEnd,
        },
      });
    }

    try {
      const { pushNotification } = await import("@/lib/notifications.server");
      await pushNotification(admin, {
        userId,
        kind: "PRO_ACTIVATED",
        title: "Plan Pro activé",
        body: `${includedMinutes} minutes incluses · cycle de ${config.cycleDays} jours.`,
        linkTo: "/dashboard",
      });
    } catch (e) {
      console.error("[notifications] pro", e);
    }

    return {
      ok: true,
      alreadyActivated: false,
      includedMinutes,
      cycleEnd,
      // True when a reserved number could not be purchased on Twilio yet
      // (kept RESERVED; activation will be retried).
      numberPending: allocation === null,
    };
  });
