import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payouts")
      .select(
        "id, status, gross_amount, gross_currency, fee_amount, net_amount, local_amount, local_currency, fx_rate, mobile_money_operator, mobile_money_number, mobile_money_holder_name, provider_reference, failure_reason, sent_at, created_at, payment_link_id",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWalletSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payouts")
      .select("status, net_amount, gross_currency, local_amount, local_currency")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const sent = rows.filter((r: any) => r.status === "SENT");
    const pending = rows.filter((r: any) => r.status === "PENDING" || r.status === "PROCESSING");
    const failed = rows.filter((r: any) => r.status === "FAILED");
    const localCurrency = sent[0]?.local_currency || rows[0]?.local_currency || null;
    const totalLocal = sent.reduce((s: number, r: any) => s + Number(r.local_amount ?? 0), 0);
    const pendingLocal = pending.reduce((s: number, r: any) => s + Number(r.local_amount ?? 0), 0);
    return {
      sentCount: sent.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      totalLocal,
      pendingLocal,
      localCurrency,
    };
  });

/** Manually retry a failed payout (simulation). */
export const retryPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { payoutId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(d.payoutId)) throw new Error("Identifiant invalide");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: po, error } = await context.supabase
      .from("payouts")
      .select("id, payment_link_id, user_id")
      .eq("id", data.payoutId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !po) throw new Error("Versement introuvable");
    if (!po.payment_link_id) throw new Error("Lien de paiement manquant");

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // delete the FAILED row then re-run the simulator
    await admin.from("payouts").delete().eq("id", po.id);
    const { data: link } = await admin
      .from("payment_links")
      .select("*")
      .eq("id", po.payment_link_id)
      .maybeSingle();
    if (!link) throw new Error("Lien introuvable");

    const { simulatePayoutForPaymentLink } = await import("@/lib/payout-simulator.server");
    const result = await simulatePayoutForPaymentLink(admin, link as any);
    return result;
  });
