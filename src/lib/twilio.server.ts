import twilio from "twilio";
import { PHONE_COUNTRIES, monthlyPriceUsd } from "@/lib/phone-countries";

export { PHONE_COUNTRIES, monthlyPriceUsd };

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
  return twilio(sid, token);
}

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  region: string | null;
  locality: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  monthlyPriceUsd: number;
  addressRequirements: string; // "none" | "any" | "local" | "foreign"
}

function rethrowTwilio(error: unknown): never {
  const e = error as any;
  if (e?.status === 401 || e?.code === 20003 || e?.message === "Authenticate") {
    throw new Error(
      "Identifiants Twilio invalides. Vérifiez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN dans vos variables d'environnement.",
    );
  }
  throw error;
}

export async function searchAvailableNumbers(
  countryIso: string,
  contains?: string,
): Promise<AvailableNumber[]> {
  const country = PHONE_COUNTRIES[countryIso];
  if (!country) throw new Error(`Country ${countryIso} not supported`);

  const hasBundleSid = !!process.env.TWILIO_BUNDLE_SID;
  if (country.requiresBundle && !hasBundleSid) {
    throw new Error(
      `Les numéros ${country.name} nécessitent un Regulatory Bundle Twilio (TWILIO_BUNDLE_SID). ` +
      `Configurez-le sur console.twilio.com → Phone Numbers → Regulatory Compliance, ou choisissez un numéro États-Unis / Canada.`,
    );
  }

  const client = getClient();

  const params: Record<string, unknown> = { limit: 20, voiceEnabled: true };
  if (contains?.trim()) params.contains = contains.trim();

  console.info(`[twilio] searchAvailableNumbers country=${countryIso}`, params);
  try {
    const numbers = await client
      .availablePhoneNumbers(countryIso)
      .local.list(params as any);

    console.info(`[twilio] searchAvailableNumbers → ${numbers.length} result(s)`, numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      region: n.region,
      locality: n.locality,
      capabilities: n.capabilities,
    })));

    const priceUsd = monthlyPriceUsd(countryIso);
    const hasAddressSid = !!process.env.TWILIO_ADDRESS_SID;

    return numbers
      .filter((n) => {
        const req = (n as any).addressRequirements as string ?? "none";
        // Only show numbers we can actually purchase
        if (!hasAddressSid && req !== "none") return false;
        return true;
      })
      .map((n) => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        region: n.region ?? null,
        locality: n.locality ?? null,
        capabilities: {
          voice: !!(n.capabilities as any).voice,
          sms:   !!(n.capabilities as any).sms,
          mms:   !!(n.capabilities as any).mms,
        },
        monthlyPriceUsd: priceUsd,
        addressRequirements: (n as any).addressRequirements ?? "none",
      }));
  } catch (error) {
    rethrowTwilio(error);
  }
}

/**
 * Public base URL Twilio can reach to fetch TwiML for incoming calls.
 * PUBLIC_APP_URL takes precedence; falls back to the current request origin.
 * Returns null for localhost origins — Twilio cannot call them (use a tunnel
 * like ngrok in dev and put its URL in PUBLIC_APP_URL).
 */
export function resolveInboundVoiceUrl(requestOrigin?: string | null): string | null {
  const base = process.env.PUBLIC_APP_URL || requestOrigin || null;
  if (!base) return null;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base)) return null;
  return `${base.replace(/\/$/, "")}/api/voice/incoming`;
}

export async function purchasePhoneNumber(
  phoneNumber: string,
  requestOrigin?: string | null,
): Promise<{ sid: string; phoneNumber: string }> {
  console.info(`[twilio] purchasePhoneNumber → ${phoneNumber}`);
  const client = getClient();
  try {
    const addressSid = process.env.TWILIO_ADDRESS_SID || undefined;
    const bundleSid = process.env.TWILIO_BUNDLE_SID || undefined;
    const voiceUrl = resolveInboundVoiceUrl(requestOrigin);
    if (!voiceUrl) {
      console.warn("[twilio] purchasePhoneNumber: no public URL — incoming calls won't be routed (set PUBLIC_APP_URL)");
    }
    const incoming = await client.incomingPhoneNumbers.create({
      phoneNumber,
      ...(addressSid ? { addressSid } : {}),
      ...(bundleSid ? { bundleSid } : {}),
      ...(voiceUrl ? { voiceUrl, voiceMethod: "POST" } : {}),
    });
    console.info(`[twilio] purchasePhoneNumber ← SID=${incoming.sid} number=${incoming.phoneNumber} voiceUrl=${voiceUrl}`);
    return { sid: incoming.sid, phoneNumber: incoming.phoneNumber };
  } catch (error) {
    console.error("[twilio] purchasePhoneNumber failed:", error);
    rethrowTwilio(error);
  }
}

/**
 * Make sure an already-purchased number routes incoming calls to our webhook.
 * Idempotent — only updates when the configured Voice URL differs.
 */
export async function ensureInboundVoiceUrl(
  twilioSid: string,
  requestOrigin?: string | null,
): Promise<void> {
  const voiceUrl = resolveInboundVoiceUrl(requestOrigin);
  if (!voiceUrl) return;
  const client = getClient();
  try {
    const number = await client.incomingPhoneNumbers(twilioSid).fetch();
    if (number.voiceUrl !== voiceUrl) {
      await client.incomingPhoneNumbers(twilioSid).update({ voiceUrl, voiceMethod: "POST" });
      console.info(`[twilio] ensureInboundVoiceUrl: ${twilioSid} → ${voiceUrl}`);
    }
  } catch (error) {
    console.warn("[twilio] ensureInboundVoiceUrl failed:", (error as Error).message);
  }
}

export async function releasePhoneNumber(twilioSid: string): Promise<void> {
  const client = getClient();
  try {
    await client.incomingPhoneNumbers(twilioSid).remove();
  } catch (error) {
    rethrowTwilio(error);
  }
}
