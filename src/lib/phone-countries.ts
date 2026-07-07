export const PHONE_COUNTRIES: Record<
  string,
  { flag: string; name: string; baseMonthlyUsd: number; requiresBundle: boolean }
> = {
  // No bundle required — work out of the box
  US: { flag: "🇺🇸", name: "États-Unis",  baseMonthlyUsd: 1.00, requiresBundle: false },
  CA: { flag: "🇨🇦", name: "Canada",      baseMonthlyUsd: 1.00, requiresBundle: false },
  // Bundle + address required (Twilio error 21649 / 21631 without them).
  // FR numbers are always searched on Twilio's *Local* inventory (never
  // National) — the bundle must therefore be "France · Local · Business".
  FR: { flag: "🇫🇷", name: "France",      baseMonthlyUsd: 1.15, requiresBundle: true },
};

export function monthlyPriceUsd(countryIso: string): number {
  const base = PHONE_COUNTRIES[countryIso]?.baseMonthlyUsd ?? 1.0;
  return Math.round((base + 5) * 100) / 100;
}
