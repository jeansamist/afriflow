import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OPERATOR_LABELS, operatorsForCountry } from "@/lib/countries";

const PATH_RE = /^[0-9a-f-]{36}\/[a-z_]+-\d+\.[a-z0-9]+$/i;

export type KycPayload = {
  idFront: string;
  idBack?: string | null;
  selfie: string;
  clientInvoice: string;
  mobileMoneyOperator: string;
  mobileMoneyNumber: string;
  mobileMoneyHolderName: string;
};

/** Soumission du dossier KYC (chemins de stockage déjà uploadés par le client). */
export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: KycPayload) => {
    if (!d.idFront || !PATH_RE.test(d.idFront))
      throw new Error("Pièce d'identité (recto) manquante.");
    if (!d.selfie || !PATH_RE.test(d.selfie)) throw new Error("Selfie manquant.");
    if (d.idBack && !PATH_RE.test(d.idBack)) throw new Error("Document verso invalide.");
    if (!d.clientInvoice || !PATH_RE.test(d.clientInvoice))
      throw new Error("Facture client manquante.");
    if (!d.mobileMoneyOperator?.trim()) throw new Error("Opérateur Mobile Money requis.");
    if (!/^\+?\d[\d\s-]{6,18}$/.test(d.mobileMoneyNumber))
      throw new Error("Numéro Mobile Money invalide.");
    if (!d.mobileMoneyHolderName?.trim()) throw new Error("Titulaire du compte requis.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("country_iso, first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    const prof = profile as {
      country_iso: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
    const allowedOps = operatorsForCountry(prof?.country_iso);
    if (!(allowedOps as string[]).includes(data.mobileMoneyOperator)) {
      const labels = allowedOps.map((op) => OPERATOR_LABELS[op]).join(", ");
      throw new Error(`Opérateur non disponible dans votre pays. Choisissez parmi : ${labels}.`);
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        kyc_status: "PENDING_REVIEW",
        kyc_submitted_at: new Date().toISOString(),
        kyc_reviewed_at: null,
        kyc_rejection_reason: null,
        kyc_doc_id_front: data.idFront,
        kyc_doc_id_back: data.idBack ?? null,
        kyc_doc_selfie: data.selfie,
        kyc_doc_address: data.clientInvoice,
        mobile_money_operator: data.mobileMoneyOperator,
        mobile_money_number: data.mobileMoneyNumber,
        mobile_money_holder_name: data.mobileMoneyHolderName,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    console.info("[kyc] dossier reçu, en file d'attente vérification", { userId });

    // Notify every admin (email via Resend + in-app). Never blocks the user.
    try {
      const fullName = [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || null;
      const email = (context.claims as { email?: string } | null)?.email ?? null;
      const origin = process.env.PUBLIC_APP_URL || new URL(getRequest().url).origin;

      const { sendAdminEmails } = await import("@/lib/email/admin-notify.server");
      await sendAdminEmails({
        templateName: "admin-kyc-submitted",
        idempotencyPrefix: `admin-kyc-${userId}-${Date.now()}`,
        templateData: {
          userName: fullName,
          userEmail: email,
          operator:
            OPERATOR_LABELS[data.mobileMoneyOperator as keyof typeof OPERATOR_LABELS] ??
            data.mobileMoneyOperator,
          mobileMoneyNumber: data.mobileMoneyNumber,
          reviewUrl: `${origin}/admin/kyc`,
        },
      });

      const { pushAdminNotification } = await import("@/lib/notifications.server");
      await pushAdminNotification({
        kind: "ADMIN_ALERT",
        title: "Nouveau dossier KYC à examiner",
        body: fullName
          ? `${fullName} a soumis son dossier de vérification d'identité.`
          : "Un utilisateur a soumis son dossier de vérification d'identité.",
        linkTo: "/admin/kyc",
      });
    } catch (e) {
      console.error("[kyc] admin notify failed", e);
    }

    return { ok: true, status: "PENDING_REVIEW" as const };
  });

/** Retourne l'état complet du dossier KYC. */
export const getKycStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "kyc_status, kyc_submitted_at, kyc_reviewed_at, kyc_rejection_reason, kyc_doc_id_front, kyc_doc_id_back, kyc_doc_selfie, kyc_doc_address, mobile_money_operator, mobile_money_number, mobile_money_holder_name, country_iso",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

/** Seuil au-delà duquel un payout requiert un KYC validé (en devise du lien). */
export const PAYOUT_KYC_THRESHOLD = 200;
