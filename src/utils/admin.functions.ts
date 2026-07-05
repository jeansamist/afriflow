import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé aux administrateurs");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return false;
    return Boolean(data);
  });

type PayoutFilters = {
  status?: "ALL" | "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  search?: string;
  page?: number;
};

export const adminListPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PayoutFilters) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const page = Math.max(1, data.page ?? 1);
    const size = 20;
    const from = (page - 1) * size;
    const to = from + size - 1;

    let q = admin
      .from("payouts")
      .select(
        "id, status, gross_amount, gross_currency, net_amount, fee_amount, local_amount, local_currency, mobile_money_operator, mobile_money_number, mobile_money_holder_name, provider_reference, failure_reason, admin_note, sent_at, created_at, user_id, payment_link_id",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.status && data.status !== "ALL") q = q.eq("status", data.status);
    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      q = q.or(
        `mobile_money_number.ilike.${term},mobile_money_holder_name.ilike.${term},provider_reference.ilike.${term}`,
      );
    }

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let profiles: Record<string, { email: string | null; first_name: string | null; last_name: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);
      const { data: usersRes } = await admin.auth.admin.listUsers({ perPage: 200 });
      const emailMap = new Map<string, string | null>();
      for (const u of usersRes?.users ?? []) emailMap.set(u.id, u.email ?? null);
      for (const p of profs ?? []) {
        profiles[p.id] = {
          email: emailMap.get(p.id) ?? null,
          first_name: p.first_name,
          last_name: p.last_name,
        };
      }
    }

    const items = (rows ?? []).map((r: any) => ({
      ...r,
      freelance: profiles[r.user_id] ?? { email: null, first_name: null, last_name: null },
    }));

    return { items, total: count ?? 0, page, size };
  });

export const adminPayoutStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [{ data: todayPayouts }, { data: todayLinks }] = await Promise.all([
      admin
        .from("payouts")
        .select("status, gross_amount, fee_amount, net_amount, gross_currency")
        .gte("created_at", startOfDay.toISOString()),
      admin
        .from("payment_links")
        .select("status, amount, currency")
        .gte("created_at", startOfDay.toISOString()),
    ]);

    const sumEur = (rows: any[], field: string) =>
      (rows ?? [])
        .filter((r) => (r.gross_currency ?? r.currency) === "EUR")
        .reduce((s, r) => s + Number(r[field] ?? 0), 0);

    return {
      transactionsToday: todayLinks?.length ?? 0,
      collectedToday: sumEur(todayLinks ?? [], "amount"),
      reversedToday: (todayPayouts ?? [])
        .filter((p: any) => p.status === "SENT")
        .reduce((s: number, p: any) => s + Number(p.net_amount ?? 0), 0),
      feesToday: (todayPayouts ?? []).reduce(
        (s: number, p: any) => s + Number(p.fee_amount ?? 0),
        0,
      ),
      pendingCount: (todayPayouts ?? []).filter((p: any) => p.status === "PENDING").length,
      failedCount: (todayPayouts ?? []).filter((p: any) => p.status === "FAILED").length,
    };
  });

type KycFilter = {
  status?: "ALL" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  search?: string;
  page?: number;
};

export const adminListKycSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: KycFilter) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const page = Math.max(1, data.page ?? 1);
    const size = 20;
    const from = (page - 1) * size;
    const to = from + size - 1;

    let q = supabaseAdmin
      .from("profiles")
      .select(
        "id, first_name, last_name, kyc_status, kyc_submitted_at, kyc_reviewed_at, kyc_rejection_reason, kyc_doc_id_front, kyc_doc_id_back, kyc_doc_selfie, kyc_doc_address, mobile_money_operator, mobile_money_number, mobile_money_holder_name",
        { count: "exact" },
      )
      .not("kyc_status", "eq", "NOT_SUBMITTED")
      .order("kyc_submitted_at", { ascending: false })
      .range(from, to);

    if (data.status && data.status !== "ALL") q = q.eq("kyc_status", data.status);
    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      q = q.or(
        `first_name.ilike.${term},last_name.ilike.${term},mobile_money_number.ilike.${term}`,
      );
    }

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = (rows ?? []).map((r) => r.id);
    const emailMap: Record<string, string | null> = {};
    if (userIds.length) {
      const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      for (const u of usersRes?.users ?? []) {
        if (userIds.includes(u.id)) emailMap[u.id] = u.email ?? null;
      }
    }

    const items = (rows ?? []).map((r) => ({ ...r, email: emailMap[r.id] ?? null }));
    return { items, total: count ?? 0, page, size };
  });

export const adminReviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; decision: "APPROVED" | "REJECTED"; reason?: string }) => {
    if (!UUID_RE.test(d.userId)) throw new Error("Identifiant utilisateur invalide");
    if (d.decision !== "APPROVED" && d.decision !== "REJECTED")
      throw new Error("Décision invalide");
    if (d.decision === "REJECTED" && !d.reason?.trim())
      throw new Error("Une raison est requise pour le refus");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        kyc_status: data.decision,
        kyc_reviewed_at: new Date().toISOString(),
        kyc_rejection_reason: data.decision === "REJECTED" ? (data.reason ?? null) : null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("first_name")
      .eq("id", data.userId)
      .maybeSingle();
    const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = userAuth?.user?.email;

    if (email) {
      try {
        const { sendAppEmail } = await import("@/lib/email/send.server");
        await sendAppEmail({
          templateName: "kyc-update",
          recipientEmail: email,
          idempotencyKey: `kyc-${data.userId}-${data.decision}-${Date.now()}`,
          templateData: {
            firstName: (prof as { first_name: string | null } | null)?.first_name,
            status: data.decision,
            reason: data.reason,
          },
        });
      } catch (e) {
        console.error("[kyc email]", e);
      }
    }

    try {
      const { pushNotification } = await import("@/lib/notifications.server");
      await pushNotification(null, {
        userId: data.userId,
        kind: "KYC_UPDATE",
        title: data.decision === "APPROVED" ? "Identité vérifiée ✅" : "Vérification refusée",
        body:
          data.decision === "APPROVED"
            ? "Vous pouvez encaisser sans plafond et activer un numéro permanent."
            : (data.reason ?? "Renvoyez une photo nette de votre pièce d'identité."),
        linkTo: "/kyc",
      });
    } catch (e) {
      console.error("[notifications] kyc", e);
    }

    return { ok: true, status: data.decision };
  });

export const adminGetKycSignedUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paths: string[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: Record<string, string | null> = {};
    for (const path of data.paths) {
      if (!path) continue;
      const { data: signed } = await supabaseAdmin.storage
        .from("kyc-documents")
        .createSignedUrl(path, 300);
      results[path] = signed?.signedUrl ?? null;
    }
    return results;
  });

export const adminUpdatePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      payoutId: string;
      status?: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
      providerReference?: string;
      failureReason?: string;
      adminNote?: string;
    }) => {
      if (!UUID_RE.test(d.payoutId)) throw new Error("Identifiant invalide");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const patch: any = { updated_at: new Date().toISOString() };
    if (data.status) patch.status = data.status;
    if (data.providerReference !== undefined) patch.provider_reference = data.providerReference;
    if (data.failureReason !== undefined) patch.failure_reason = data.failureReason;
    if (data.adminNote !== undefined) patch.admin_note = data.adminNote;
    if (data.status === "SENT") patch.sent_at = new Date().toISOString();

    const { data: updated, error } = await admin
      .from("payouts")
      .update(patch)
      .eq("id", data.payoutId)
      .select("user_id, status, local_amount, local_currency, failure_reason")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Versement introuvable");

    // Notify the freelance on status change
    if (data.status === "SENT" || data.status === "FAILED") {
      const { pushNotification } = await import("@/lib/notifications.server");
      const isSent = data.status === "SENT";
      await pushNotification(admin, {
        userId: updated.user_id,
        kind: isSent ? "PAYOUT_SENT" : "PAYOUT_FAILED",
        title: isSent ? "Dépôt envoyé" : "Échec du dépôt",
        body: isSent
          ? `Votre dépôt de ${Number(updated.local_amount ?? 0).toLocaleString("fr-FR")} ${updated.local_currency ?? ""} a été envoyé sur votre Mobile Money.`
          : updated.failure_reason ?? "Le dépôt n'a pas pu être effectué. Notre équipe vous recontacte.",
        linkTo: "/billing",
      });
    }

    return { ok: true };
  });
