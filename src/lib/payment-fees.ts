/**
 * Payment link fees by billing zone (invoice currency determines the zone).
 *  - Frais de transfert (fixe) : 2,00 dans la devise de facturation
 *  - Frais de service AfriFlow : 4 % Europe (EUR) · 5 % USA & Canada (USD, CAD)
 */
export const TRANSFER_FEE_FIXED = 2;

const SERVICE_RATE_EU = 0.04;
const SERVICE_RATE_NA = 0.05;

const CURRENCY_SERVICE_RATES: Record<string, number> = {
  EUR: SERVICE_RATE_EU,
  USD: SERVICE_RATE_NA,
  CAD: SERVICE_RATE_NA,
};

export function paymentFeeRate(currency: string): number {
  return CURRENCY_SERVICE_RATES[currency.toUpperCase()] ?? SERVICE_RATE_EU;
}

export function paymentFeeBreakdown(amount: number, currency: string) {
  const rate = paymentFeeRate(currency);
  const serviceFee = Math.round(amount * rate * 100) / 100;
  const transferFee = TRANSFER_FEE_FIXED;
  const fee = Math.round((serviceFee + transferFee) * 100) / 100;
  // Can be negative on tiny amounts — callers must block creation (transfert impossible).
  const net = Math.round((amount - fee) * 100) / 100;
  return { rate, transferFee, serviceFee, fee, net };
}

/** True when the amount doesn't even cover the fees (nothing left to transfer). */
export function isAmountTooLow(amount: number, currency: string): boolean {
  return paymentFeeBreakdown(amount, currency).net <= 0;
}

/** Smallest invoice amount that leaves a strictly positive net. */
export function minimumInvoiceAmount(currency: string): number {
  const rate = paymentFeeRate(currency);
  // net > 0 ⇔ amount × (1 − rate) > TRANSFER_FEE_FIXED
  return Math.ceil((TRANSFER_FEE_FIXED / (1 - rate)) * 100) / 100;
}

export function paymentFeeLabel(currency: string): string {
  const pct = (paymentFeeRate(currency) * 100).toLocaleString("fr-FR");
  return `${TRANSFER_FEE_FIXED.toFixed(2)} ${currency.toUpperCase()} + ${pct} %`;
}
