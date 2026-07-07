import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Country -> mobile prefix generators (E.164). Simulated only.
const COUNTRY_PREFIXES: Record<string, { cc: string; gen: () => string }> = {
  FR: { cc: "+33", gen: () => pick(["1", "6", "7"]) + randDigits(8) },
  BE: { cc: "+32", gen: () => "4" + randDigits(8) },
  US: { cc: "+1", gen: () => pick(["415", "212", "305"]) + randDigits(7) },
  CA: { cc: "+1", gen: () => pick(["514", "416", "604"]) + randDigits(7) },
  CM: { cc: "+237", gen: () => "6" + randDigits(8) },
  SN: { cc: "+221", gen: () => "7" + pick(["0", "5", "6", "7", "8"]) + randDigits(7) },
  BJ: { cc: "+229", gen: () => "9" + randDigits(7) },
  CI: { cc: "+225", gen: () => "0" + pick(["1", "5", "7"]) + randDigits(8) },
  GA: { cc: "+241", gen: () => "0" + pick(["6", "7"]) + randDigits(7) },
  ML: { cc: "+223", gen: () => pick(["6", "7", "9"]) + randDigits(7) },
};

function randDigits(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}
function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateE164(country: string) {
  const cfg = COUNTRY_PREFIXES[country] ?? COUNTRY_PREFIXES.CM;
  return cfg.cc + cfg.gen();
}

export const allocatePhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { country?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Idempotent — return existing active allocation if any
    const { data: existing } = await supabase
      .from("phone_allocations")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (existing) return { allocation: existing, alreadyAllocated: true };

    // Resolve country + KYC from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("country_iso, kyc_status")
      .eq("id", userId)
      .maybeSingle();

    // Trial: allocate immediately (KYC bypassed). Outside trial: KYC required.
    const { data: walletRow } = await supabase
      .from("phone_wallets")
      .select("plan_status")
      .eq("user_id", userId)
      .maybeSingle();
    const inTrial = (walletRow as any)?.plan_status === "TRIAL";
    if (!inTrial && profile?.kyc_status !== "APPROVED") {
      throw new Error("Vérification d'identité (KYC) requise avant d'activer un numéro.");
    }

    const country = data.country ?? profile?.country_iso ?? "CM";

    // Try a few times in case of unique collision
    let e164 = "";
    let inserted: any = null;
    for (let i = 0; i < 5; i++) {
      e164 = generateE164(country);
      const { data: row, error } = await supabase
        .from("phone_allocations")
        .insert({
          user_id: userId,
          e164,
          country_iso: country,
          provider: "SIMULATED",
          status: "ACTIVE",
        })
        .select()
        .single();
      if (!error) {
        inserted = row;
        break;
      }
      if (!String(error.message).toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    }
    if (!inserted) throw new Error("Impossible d'attribuer un numéro, réessayez.");

    await supabase.from("profiles").update({ allocated_phone_number: e164 }).eq("id", userId);

    try {
      const { pushNotification } = await import("@/lib/notifications.server");
      await pushNotification(null, {
        userId,
        kind: "NUMBER_ACTIVATED",
        title: `Numéro activé · ${e164}`,
        body: inTrial
          ? "Essai 7 jours · 10 minutes offertes."
          : "Votre cabine est prête à appeler.",
        linkTo: "/phone",
        metadata: { country, e164 },
      });
    } catch (e) {
      console.error("[notifications] number", e);
    }

    return { allocation: inserted, alreadyAllocated: false };
  });

export const getMyPhoneState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: allocation }, { data: reserved }, { data: logs }] = await Promise.all([
      supabase
        .from("phone_allocations")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("phone_allocations")
        .select("e164, country_iso")
        .eq("user_id", userId)
        .eq("status", "RESERVED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("call_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    return {
      allocation,
      reserved: (reserved as { e164: string; country_iso: string } | null) ?? null,
      logs: logs ?? [],
    };
  });

const callSchema = z.object({
  to: z.string().trim().min(4, "Numéro requis").max(20),
  direction: z.enum(["OUTBOUND", "INBOUND"]).default("OUTBOUND"),
  durationSeconds: z.number().int().min(0).max(7200),
  outcome: z.enum(["completed", "no-answer", "busy", "failed"]).default("completed"),
  dossierId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
});

export const recordSimulatedCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof callSchema>) => callSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.direction === "OUTBOUND") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("kyc_status")
        .eq("id", userId)
        .maybeSingle();
      if ((profile?.kyc_status as string | null) !== "APPROVED")
        throw new Error(
          "Vérification d'identité requise : complétez votre KYC pour passer des appels.",
        );
    }

    const { data: allocation } = await supabase
      .from("phone_allocations")
      .select("e164")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (!allocation) throw new Error("Aucun numéro actif. Activez votre cabine d'abord.");

    const from = data.direction === "OUTBOUND" ? allocation.e164 : data.to;
    const to = data.direction === "OUTBOUND" ? data.to : allocation.e164;

    // Mock pricing: 0.02 credits per second, only when connected
    const cost =
      data.outcome === "completed" ? Number((data.durationSeconds * 0.02).toFixed(2)) : 0;

    const { data: log, error } = await supabase
      .from("call_logs")
      .insert({
        user_id: userId,
        twilio_call_sid: `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        from_number: from,
        to_number: to,
        direction: data.direction,
        status: data.outcome,
        duration_seconds: data.durationSeconds,
        cost_credits: cost,
        dossier_id: data.dossierId ?? null,
        client_id: data.clientId ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { log };
  });
