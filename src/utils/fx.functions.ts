import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Currency conversion utilities for AfriFlow.
 *
 * Strategy:
 *  - Major pairs (EUR/USD/CAD between each other) are fetched live from
 *    https://api.frankfurter.dev (ECB reference rates, no API key).
 *  - African currencies are derived from EUR via either a fixed peg
 *    (XOF/XAF = 655.957/EUR) or a curated reference table with a small
 *    deterministic daily drift to simulate market movement.
 *  - Every successful lookup is cached in public.fx_rates so historical
 *    rates remain auditable per payment link.
 */

export const SUPPORTED_INVOICE = ["EUR", "USD", "CAD"] as const;
export const SUPPORTED_PAYOUT = [
  "XOF", "XAF", "NGN", "KES", "GHS", "MAD", "RWF", "EGP", "ZAR", "EUR", "USD",
] as const;

export type InvoiceCurrency = (typeof SUPPORTED_INVOICE)[number];
export type PayoutCurrency = (typeof SUPPORTED_PAYOUT)[number];

/** ECB-style reference rate per 1 EUR. Updated periodically; live drift simulated. */
const EUR_REFERENCE: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  CAD: 1.47,
  GBP: 0.85,
  CHF: 0.95,
  XOF: 655.957, // fixed peg
  XAF: 655.957, // fixed peg
  NGN: 1720,
  KES: 139,
  GHS: 16.2,
  MAD: 10.85,
  RWF: 1480,
  EGP: 53,
  ZAR: 20.1,
};

const FIXED_PEG = new Set(["XOF", "XAF"]);

const COUNTRY_TO_CURRENCY: Record<string, PayoutCurrency> = {
  SN: "XOF", CI: "XOF", BJ: "XOF", BF: "XOF", ML: "XOF", NE: "XOF", TG: "XOF", GW: "XOF",
  CM: "XAF", GA: "XAF", CG: "XAF", CF: "XAF", TD: "XAF", GQ: "XAF",
  NG: "NGN", KE: "KES", GH: "GHS", MA: "MAD", RW: "RWF", EG: "EGP", ZA: "ZAR",
};

export function payoutCurrencyForCountry(iso: string | null | undefined): PayoutCurrency {
  if (!iso) return "XOF";
  return COUNTRY_TO_CURRENCY[iso.toUpperCase()] ?? "XOF";
}

/** Deterministic drift between -1% and +1% per day, so demos look alive. */
function drift(base: string, quote: string): number {
  const key = `${base}${quote}`;
  const day = Math.floor(Date.now() / 86_400_000);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const seed = Math.sin(h + day) * 10000;
  return 1 + (((seed - Math.floor(seed)) - 0.5) / 50); // ±1%
}

async function fetchFrankfurter(base: string, quote: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { rates?: Record<string, number> };
    return j.rates?.[quote] ?? null;
  } catch {
    return null;
  }
}

function rateFromReference(base: string, quote: string): number {
  if (base === quote) return 1;
  const b = EUR_REFERENCE[base];
  const q = EUR_REFERENCE[quote];
  if (!b || !q) throw new Error(`Devise non supportée: ${base}/${quote}`);
  const raw = q / b;
  if (FIXED_PEG.has(quote) || FIXED_PEG.has(base)) return raw; // peg = no drift
  return raw * drift(base, quote);
}

async function computeRate(base: string, quote: string): Promise<{ rate: number; source: string }> {
  base = base.toUpperCase();
  quote = quote.toUpperCase();
  if (base === quote) return { rate: 1, source: "identity" };

  const majors = new Set(["EUR", "USD", "CAD", "GBP", "CHF"]);
  if (majors.has(base) && majors.has(quote)) {
    const live = await fetchFrankfurter(base, quote);
    if (live) return { rate: live, source: "frankfurter" };
  }
  return { rate: rateFromReference(base, quote), source: FIXED_PEG.has(quote) ? "peg" : "reference" };
}

/** Get a fresh quote (cached < 6h) without requiring auth. */
export const getRate = createServerFn({ method: "POST" })
  .inputValidator((d: { base: string; quote: string }) => ({
    base: d.base.toUpperCase(),
    quote: d.quote.toUpperCase(),
  }))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const sixHoursAgo = new Date(Date.now() - 6 * 3600_000).toISOString();
    const { data: cached } = await admin
      .from("fx_rates")
      .select("rate, source, fetched_at")
      .eq("base_currency", data.base)
      .eq("quote_currency", data.quote)
      .gte("fetched_at", sixHoursAgo)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached) return { rate: Number(cached.rate), source: cached.source, fetched_at: cached.fetched_at };

    const { rate, source } = await computeRate(data.base, data.quote);
    const { data: inserted } = await admin
      .from("fx_rates")
      .insert({ base_currency: data.base, quote_currency: data.quote, rate, source })
      .select("fetched_at")
      .single();
    return { rate, source, fetched_at: inserted?.fetched_at ?? new Date().toISOString() };
  });

/** Compute the local equivalent for a given invoice amount + payout currency. */
export async function convertAmount(
  base: string,
  quote: string,
  amount: number,
): Promise<{ rate: number; localAmount: number; source: string }> {
  const { rate, source } = await computeRate(base, quote);
  return { rate, source, localAmount: Math.round(amount * rate * 100) / 100 };
}

/** Historical rate log (last 90 days) for a pair. */
export const listRateHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { base: string; quote: string }) => ({
    base: d.base.toUpperCase(),
    quote: d.quote.toUpperCase(),
  }))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data: rows, error } = await admin
      .from("fx_rates")
      .select("rate, source, fetched_at")
      .eq("base_currency", data.base)
      .eq("quote_currency", data.quote)
      .gte("fetched_at", since)
      .order("fetched_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
