import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type PaymentIntentResult = { clientSecret: string; paymentIntentId: string } | { error: string };

/**
 * Creates a payment_links row + a Stripe Checkout session (embedded mode).
 * The owner uses this to generate a shareable link to bill a client.
 */
export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      amount: number; // major unit (e.g. EUR)
      currency: string; // ISO lowercase, e.g. "eur", "xof"
      description: string;
      clientId?: string | null;
      dossierId?: string | null;
    }) => {
      if (!data.amount || data.amount <= 0) throw new Error("Montant invalide");
      if (!data.description?.trim()) throw new Error("Description requise");
      const currency = (data.currency || "eur").toLowerCase();
      if (!/^[a-z]{3}$/.test(currency)) throw new Error("Devise invalide");
      return { ...data, currency };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const invoiceCurrency = data.currency.toUpperCase();

    // Resolve payout currency (profile override or derived from country)
    const { convertAmount, payoutCurrencyForCountry, getRate } = await import("./fx.functions");
    const { data: profile } = await supabase
      .from("profiles")
      .select("payout_currency, country_iso, kyc_status")
      .eq("id", userId)
      .maybeSingle();

    if ((profile?.kyc_status as string | null) !== "APPROVED")
      throw new Error(
        "Vérification d'identité requise : complétez votre KYC pour créer des liens de paiement.",
      );

    const payoutCurrency =
      (profile?.payout_currency as string | null) ||
      payoutCurrencyForCountry(profile?.country_iso as string | null);

    // ---- Beta safeguard: 500 EUR / day / user across all payment links ----
    const DAILY_LIMIT_EUR = 500;
    let amountInEur = data.amount;
    if (invoiceCurrency !== "EUR") {
      try {
        const r = await getRate({ data: { base: invoiceCurrency, quote: "EUR" } });
        amountInEur = Math.round(data.amount * r.rate * 100) / 100;
      } catch {
        throw new Error("Devise non supportée pour le moment (taux indisponible).");
      }
    }
    const { data: todayTotalRow, error: totalErr } = await supabase.rpc("daily_payment_total_eur", {
      _user_id: userId,
    });
    if (totalErr) throw new Error(totalErr.message);
    const todayTotalEur = Number(todayTotalRow ?? 0);
    if (todayTotalEur + amountInEur > DAILY_LIMIT_EUR) {
      const remaining = Math.max(0, DAILY_LIMIT_EUR - todayTotalEur);
      throw new Error(
        remaining <= 0
          ? `Vous avez atteint votre limite quotidienne de paiement (${DAILY_LIMIT_EUR} €). Vous pourrez créer un nouveau lien demain.`
          : `Ce lien dépasserait votre limite quotidienne (${DAILY_LIMIT_EUR} €). Il vous reste ${remaining.toFixed(2)} € disponibles aujourd'hui.`,
      );
    }

    let localAmount: number | null = null;
    let fxRate: number | null = null;
    let fxLockedAt: string | null = null;
    try {
      const conv = await convertAmount(invoiceCurrency, payoutCurrency, data.amount);
      localAmount = conv.localAmount;
      fxRate = conv.rate;
      fxLockedAt = new Date().toISOString();
    } catch {
      // Unsupported pair → store invoice values only; UI can fall back gracefully.
    }

    const { data: row, error } = await supabase
      .from("payment_links")
      .insert({
        user_id: userId,
        amount: data.amount,
        currency: invoiceCurrency,
        description: data.description.trim(),
        status: "GENERATED",
        client_id: data.clientId ?? null,
        dossier_id: data.dossierId ?? null,
        local_currency: payoutCurrency,
        local_amount: localAmount,
        fx_rate: fxRate,
        fx_locked_at: fxLockedAt,
      })
      .select()
      .single();
    if (error || !row) throw new Error(error?.message || "Création impossible");
    return { id: row.id as string };
  });

/**
 * Creates a Stripe PaymentIntent for an existing payment_links row.
 * Returns the client secret so the browser can render PaymentElement directly.
 */
export const createPaymentIntent = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentLinkId: string; environment: StripeEnv }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.paymentLinkId)) throw new Error("Lien invalide");
    return data;
  })
  .handler(async ({ data }): Promise<PaymentIntentResult> => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

      const { data: link, error } = await admin
        .from("payment_links")
        .select("*")
        .eq("id", data.paymentLinkId)
        .maybeSingle();
      if (error || !link) return { error: "Lien introuvable" };
      if (link.status === "PAID") return { error: "Ce paiement a déjà été réglé" };

      const stripe = createStripeClient(data.environment);
      const amountMinor = Math.round(Number(link.amount) * 100);

      const intent = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency: String(link.currency).toLowerCase(),
        description: link.description,
        automatic_payment_methods: { enabled: true },
        metadata: {
          payment_link_id: link.id,
          afriflow_user_id: link.user_id,
          environment: data.environment,
        },
      });

      await admin
        .from("payment_links")
        .update({ stripe_payment_intent_id: intent.id })
        .eq("id", link.id);

      return { clientSecret: intent.client_secret!, paymentIntentId: intent.id };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/**
 * Verifies a PaymentIntent with Stripe then marks the payment link as PAID.
 * Called client-side right after stripe.confirmPayment() succeeds.
 */
export const markPaymentLinkPaid = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { paymentLinkId: string; paymentIntentId: string; environment: StripeEnv }) => {
      if (!/^[0-9a-f-]{36}$/i.test(data.paymentLinkId)) throw new Error("Lien invalide");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Verify with Stripe before trusting the client
    const stripe = createStripeClient(data.environment);
    const intent = await stripe.paymentIntents.retrieve(data.paymentIntentId);
    if (intent.status !== "succeeded") throw new Error("Le paiement n'est pas encore confirmé.");
    if (intent.metadata?.payment_link_id !== data.paymentLinkId)
      throw new Error("Référence invalide.");

    const { data: link } = await admin
      .from("payment_links")
      .select("*")
      .eq("id", data.paymentLinkId)
      .maybeSingle();
    if (!link) throw new Error("Lien introuvable");
    if (link.status === "PAID") return { ok: true, alreadyPaid: true };

    await admin
      .from("payment_links")
      .update({ status: "PAID", stripe_payment_intent_id: data.paymentIntentId })
      .eq("id", data.paymentLinkId);

    await admin.from("ledger_entries").insert({
      user_id: link.user_id,
      amount: link.amount,
      currency: link.currency,
      entry_type: "CREDIT",
      reference_id: `payment_link:${link.id}`,
      metadata: { source: "stripe", payment_intent_id: data.paymentIntentId },
    });

    try {
      const { simulatePayoutForPaymentLink } = await import("@/lib/payout-simulator.server");
      const refreshed = await admin.from("payment_links").select("*").eq("id", link.id).single();
      if (refreshed.data) await simulatePayoutForPaymentLink(admin, refreshed.data as any);
    } catch (e) {
      console.error("[markPaymentLinkPaid] payout simulation failed", e);
    }

    return { ok: true, alreadyPaid: false };
  });

export const listPaymentLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("payment_links")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPublicPaymentLink = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentLinkId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.paymentLinkId)) throw new Error("Lien invalide");
    return data;
  })
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: row, error } = await admin
      .from("payment_links")
      .select("id, amount, currency, description, status")
      .eq("id", data.paymentLinkId)
      .maybeSingle();
    if (error || !row) throw new Error("Lien introuvable");
    return row;
  });
