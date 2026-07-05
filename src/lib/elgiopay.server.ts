const BASE_URL = process.env.ELGIOPAY_BASE_URL ?? "https://sandbox-api.elgiopay.com";

// Fixed rate: both XAF and XOF are CFA franc, pegged to EUR.
// 1 USD ≈ 0.93 EUR ≈ 655.957 XAF, so ~610 XAF.
// We use 600 as a conservative round rate.
const USD_TO_XAF = Number(process.env.ELGIOPAY_USD_TO_XAF_RATE ?? 600);

export type ElgioPaymentMethod = "mtn_mobile_money" | "orange_money";
export type ElgioPayCurrency = "XAF" | "XOF" | "EUR";

export interface InitiatePaymentParams {
  amount: number;
  currency: ElgioPayCurrency;
  payment_method: ElgioPaymentMethod;
  customer_phone: string;
  customer_name?: string;
  customer_email?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitResponse {
  success: boolean;
  transaction_id: string;
  status: string;
  payment_url: string | null;
  message: string;
}

export interface PaymentStatusResponse {
  transaction_id: string;
  type: string;
  status: string;
  amount: { total: number; currency: string; fees?: number; net_amount?: number };
  payment: { method: string };
  customer: { phone: string; name?: string; email?: string };
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

function apiKey(): string {
  const key = process.env.ELGIOPAY_SECRET_KEY;
  if (!key) throw new Error("ELGIOPAY_SECRET_KEY is not configured");
  return key;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const method = init.method ?? "GET";
  const body = init.body ? JSON.parse(init.body as string) : undefined;
  console.info(`[elgiopay] → ${method} ${url}`, body ?? "");

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
      ...(init.headers ?? {}),
    },
  });
  const json = await res.json();
  console.info(`[elgiopay] ← ${res.status} ${url}`, json);

  if (!res.ok) {
    throw new Error((json as { message?: string }).message ?? `ElgioPay error ${res.status}`);
  }
  return json as T;
}

export function initiatePayment(params: InitiatePaymentParams) {
  return request<PaymentInitResponse>("/api/v1/payments", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function getPaymentStatus(transactionId: string) {
  return request<PaymentStatusResponse>(`/api/v1/payments/${transactionId}`);
}

export function verifyPayment(transactionId: string) {
  return request<PaymentStatusResponse>(`/api/v1/payments/${transactionId}/verify`, {
    method: "POST",
  });
}

// Detect XAF vs XOF from E.164 mobile money phone prefix.
export function detectCurrency(phone: string): ElgioPayCurrency {
  const xafPrefixes = ["+237", "+241", "+242", "+236", "+240", "+235"];
  for (const p of xafPrefixes) {
    if (phone.startsWith(p)) return "XAF";
  }
  return "XOF"; // Senegal, Benin, Côte d'Ivoire, Mali, Niger, Togo…
}

export function usdToLocal(usd: number, _currency: ElgioPayCurrency): number {
  // Both XAF and XOF use the same CFA franc peg. EUR would need a different rate.
  return Math.round(usd * USD_TO_XAF);
}

// EUR → CFA. Marketing rate (21 € = 13 755 FCFA); the official peg is 655.957.
const EUR_TO_CFA = Number(process.env.ELGIOPAY_EUR_TO_CFA_RATE ?? 655);

export function eurToLocal(eur: number, currency: ElgioPayCurrency): number {
  if (currency === "EUR") return Math.round(eur * 100) / 100;
  return Math.round(eur * EUR_TO_CFA);
}
