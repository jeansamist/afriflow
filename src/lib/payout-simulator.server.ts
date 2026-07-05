/**
 * Simulated Flutterwave → Mobile Money payout engine.
 * Server-only. Triggered by the Stripe webhook on successful checkout.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { paymentFeeBreakdown } from "@/lib/payment-fees";

type AdminClient = SupabaseClient<any, any, any>;

export type PayoutSimulationResult =
  | { ok: true; payoutId: string; status: "SENT" | "PENDING" }
  | { ok: false; reason: string };

/**
 * Called after a Stripe checkout.session.completed event marks a payment_link PAID.
 * Computes fees, creates a `payouts` row, and "transfers" funds to the freelancer's
 * Mobile Money number through a fictive provider.
 */
export async function simulatePayoutForPaymentLink(
  admin: AdminClient,
  paymentLink: {
    id: string;
    user_id: string;
    amount: number;
    currency: string;
    local_amount: number | null;
    local_currency: string | null;
    fx_rate: number | null;
    description: string;
  },
): Promise<PayoutSimulationResult> {
  // 1) Idempotency: skip if a payout for this payment_link already exists.
  const { data: existing } = await admin
    .from("payouts")
    .select("id, status")
    .eq("payment_link_id", paymentLink.id)
    .maybeSingle();
  if (existing) {
    return { ok: true, payoutId: existing.id, status: existing.status as "SENT" };
  }

  // 2) Resolve recipient Mobile Money details from the user profile.
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "first_name, last_name, mobile_money_operator, mobile_money_number, mobile_money_holder_name, payout_currency, kyc_status",
    )
    .eq("id", paymentLink.user_id)
    .maybeSingle();

  if (!profile?.mobile_money_number || !profile?.mobile_money_operator) {
    // Create a FAILED payout row so the user sees what blocked the transfer.
    const { data: failed } = await admin
      .from("payouts")
      .insert({
        user_id: paymentLink.user_id,
        payment_link_id: paymentLink.id,
        gross_amount: paymentLink.amount,
        gross_currency: paymentLink.currency,
        fee_amount: 0,
        net_amount: paymentLink.amount,
        status: "FAILED",
        failure_reason: "Aucun compte Mobile Money configuré dans Facturation.",
      })
      .select("id")
      .single();
    const { pushNotification } = await import("@/lib/notifications.server");
    await pushNotification(admin, {
      userId: paymentLink.user_id,
      kind: "PAYOUT_FAILED",
      title: "Virement Mobile Money impossible",
      body: "Aucun compte Mobile Money configuré. Renseignez-le dans Facturation.",
      linkTo: "/billing",
    });
    return { ok: false, reason: "missing_mobile_money", ...((failed && { payoutId: failed.id }) || {}) } as any;
  }

  // 2.bis) KYC gating — au-delà du seuil, exiger un KYC validé.
  const KYC_THRESHOLD = 200;
  if (Number(paymentLink.amount) > KYC_THRESHOLD && profile.kyc_status !== "APPROVED") {
    const { data: failed } = await admin
      .from("payouts")
      .insert({
        user_id: paymentLink.user_id,
        payment_link_id: paymentLink.id,
        gross_amount: paymentLink.amount,
        gross_currency: paymentLink.currency,
        fee_amount: 0,
        net_amount: paymentLink.amount,
        status: "FAILED",
        failure_reason: `Vérification d'identité requise pour les montants supérieurs à ${KYC_THRESHOLD} ${paymentLink.currency}.`,
      })
      .select("id")
      .single();
    return { ok: false, reason: "kyc_required", ...((failed && { payoutId: failed.id }) || {}) } as any;
  }

  // 3) Fees + net amounts (5,5 % FR/BE · 4,5 % US/CA, based on invoice currency).
  const gross = Number(paymentLink.amount);
  const { fee, net } = paymentFeeBreakdown(gross, paymentLink.currency);
  const fxRate = paymentLink.fx_rate ? Number(paymentLink.fx_rate) : null;
  const localCurrency = paymentLink.local_currency || (profile.payout_currency as string | null);
  const localAmount =
    fxRate != null ? Math.round(net * fxRate * 100) / 100 : (paymentLink.local_amount ? Number(paymentLink.local_amount) : null);

  // 4) Create the payout as PROCESSING.
  const providerReference = `FW-SIM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e4)
    .toString(36)
    .toUpperCase()}`;

  const { data: inserted, error: insErr } = await admin
    .from("payouts")
    .insert({
      user_id: paymentLink.user_id,
      payment_link_id: paymentLink.id,
      gross_amount: gross,
      gross_currency: paymentLink.currency,
      fee_amount: fee,
      net_amount: net,
      local_amount: localAmount,
      local_currency: localCurrency,
      fx_rate: fxRate,
      mobile_money_operator: profile.mobile_money_operator,
      mobile_money_number: profile.mobile_money_number,
      mobile_money_holder_name: profile.mobile_money_holder_name,
      status: "PROCESSING",
      provider: "flutterwave_simulated",
      provider_reference: providerReference,
    })
    .select("*")
    .single();
  if (insErr || !inserted) {
    return { ok: false, reason: insErr?.message || "insert_failed" };
  }

  // 5) "Send" — simulate a short network latency, then mark SENT.
  //    A 90% success rate; failures get a fictive reason so the UI can recover.
  const success = Math.random() < 0.92;
  await new Promise((r) => setTimeout(r, 400));

  if (!success) {
    await admin
      .from("payouts")
      .update({
        status: "FAILED",
        failure_reason: "Échec opérateur Mobile Money (timeout, simulation).",
      })
      .eq("id", inserted.id);
    try {
      const { pushNotification, pushAdminNotification } = await import("@/lib/notifications.server");
      await pushNotification(admin, {
        userId: paymentLink.user_id,
        kind: "PAYOUT_FAILED",
        title: "Virement Mobile Money échoué",
        body: `Référence ${providerReference} · Vous pouvez relancer depuis Facturation.`,
        linkTo: "/billing",
        metadata: { payout_id: inserted.id },
      });
      await pushAdminNotification({
        kind: "ADMIN_ALERT",
        title: `Payout FAILED · ${net} ${paymentLink.currency}`,
        body: `Opérateur timeout · ${providerReference}`,
        linkTo: "/admin/payouts",
        metadata: { payout_id: inserted.id },
      });
    } catch (e) { console.error("[notifications] payout-fail", e); }
    return { ok: false, reason: "operator_timeout", payoutId: inserted.id } as any;
  }

  await admin
    .from("payouts")
    .update({ status: "SENT", sent_at: new Date().toISOString() })
    .eq("id", inserted.id);

  // In-app notifications: payment received + payout sent
  try {
    const { pushNotification, pushAdminNotification } = await import("@/lib/notifications.server");
    await pushNotification(admin, {
      userId: paymentLink.user_id,
      kind: "PAYMENT_PAID",
      title: `Paiement reçu · ${gross} ${paymentLink.currency}`,
      body: paymentLink.description ? `Facture : ${paymentLink.description}` : undefined,
      linkTo: "/payments",
      metadata: { payment_link_id: paymentLink.id },
    });
    await pushNotification(admin, {
      userId: paymentLink.user_id,
      kind: "PAYOUT_SENT",
      title: `Virement Mobile Money envoyé`,
      body: `${localAmount ?? net} ${localCurrency ?? paymentLink.currency} crédités sur ${profile.mobile_money_number}.`,
      linkTo: "/billing",
      metadata: { payout_id: inserted.id, reference: providerReference },
    });
    await pushAdminNotification({
      kind: "ADMIN_ALERT",
      title: `Payout SENT · ${net} ${paymentLink.currency}`,
      body: `Utilisateur ${paymentLink.user_id.slice(0, 8)} · ${providerReference}`,
      linkTo: "/admin/payouts",
      metadata: { payout_id: inserted.id },
    });
  } catch (e) {
    console.error("[notifications] payout", e);
  }

  // 6) Email confirmation via app email queue.
  try {
    const { data: userRes } = await (admin as any).auth.admin.getUserById(paymentLink.user_id);
    const recipient = userRes?.user?.email as string | undefined;
    if (recipient) {
      const { sendAppEmail } = await import("@/lib/email/send.server");
      await sendAppEmail({
        templateName: "payout-credited",
        recipientEmail: recipient,
        idempotencyKey: `payout-${inserted.id}`,
        templateData: {
          firstName: profile.first_name ?? "",
          amount: localAmount ?? net,
          currency: localCurrency ?? paymentLink.currency,
          reference: providerReference,
          mobileMoneyNumber: profile.mobile_money_number,
        },
      });
    }
  } catch (e) {
    console.error("[payout email]", e);
  }

  return { ok: true, payoutId: inserted.id, status: "SENT" };
}
