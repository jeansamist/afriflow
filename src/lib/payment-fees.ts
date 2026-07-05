/**
 * Payment link fees by billing zone.
 *  - France / Belgique (EUR)  → 5,5 %
 *  - USA / Canada (USD, CAD)  → 4,5 %
 * The invoice currency determines the zone; no fixed fee.
 */
const FEE_RATE_EU = 0.055;
const FEE_RATE_NA = 0.045;

const CURRENCY_FEE_RATES: Record<string, number> = {
  EUR: FEE_RATE_EU,
  USD: FEE_RATE_NA,
  CAD: FEE_RATE_NA,
};

export function paymentFeeRate(currency: string): number {
  return CURRENCY_FEE_RATES[currency.toUpperCase()] ?? FEE_RATE_EU;
}

export function paymentFeeBreakdown(amount: number, currency: string) {
  const rate = paymentFeeRate(currency);
  const fee = Math.round(amount * rate * 100) / 100;
  const net = Math.max(0, Math.round((amount - fee) * 100) / 100);
  return { rate, fee, net };
}

export function paymentFeeLabel(currency: string): string {
  return `${(paymentFeeRate(currency) * 100).toLocaleString("fr-FR")} %`;
}
