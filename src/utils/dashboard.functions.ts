import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [profileRes, allocRes, clientsRes, callsRes, paymentsRes, monthCallsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name, kyc_status, kyc_rejection_reason, kyc_submitted_at, kyc_reviewed_at, allocated_phone_number, country_iso, mobile_money_number, mobile_money_operator, payout_currency, is_premium")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("phone_allocations")
        .select("e164, country_iso, status")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .maybeSingle(),
      supabase.from("crm_clients").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("call_logs")
        .select("id, to_number, from_number, direction, status, duration_seconds, created_at, client_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("payment_links")
        .select("id, amount, currency, local_amount, local_currency, fx_rate, description, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("call_logs")
        .select("duration_seconds, status")
        .eq("user_id", userId)
        .gte("created_at", monthStart.toISOString()),
    ]);

    const payments = paymentsRes.data ?? [];
    const paid = payments.filter((p) => p.status === "PAID");
    const profile = profileRes.data as any;
    const payoutCurrency: string =
      profile?.payout_currency ||
      (await import("./fx.functions")).payoutCurrencyForCountry(profile?.country_iso);

    // Minutes plan — demo: 300 min/month free quota. Only completed calls consume.
    const MINUTES_QUOTA = 300;
    const usedSeconds = (monthCallsRes.data ?? [])
      .filter((c: any) => c.status === "completed")
      .reduce((s: number, c: any) => s + Number(c.duration_seconds ?? 0), 0);
    const usedMinutes = Math.floor(usedSeconds / 60);
    const remainingMinutes = Math.max(0, MINUTES_QUOTA - usedMinutes);

    return {
      profile: profileRes.data ?? null,
      allocation: allocRes.data ?? null,
      counts: {
        clients: clientsRes.count ?? 0,
        paidCount: paid.length,
        paidTotal: paid.reduce((s, p) => s + Number(p.amount), 0),
        paidLocalTotal: paid.reduce(
          (s, p) => s + Number((p as any).local_amount ?? p.amount ?? 0),
          0,
        ),
        payoutCurrency,
        pendingCount: payments.filter((p) => p.status === "GENERATED").length,
      },
      minutes: {
        quota: MINUTES_QUOTA,
        used: usedMinutes,
        remaining: remainingMinutes,
        periodStart: monthStart.toISOString(),
      },
      recentCalls: callsRes.data ?? [],
      recentPayments: payments,
    };
  });


export const simulateKycApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ kyc_status: "APPROVED" })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
