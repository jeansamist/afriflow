import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("first_name, last_name, country_iso, mobile_money_number, mobile_money_operator, mobile_money_holder_name, allocated_phone_number, kyc_status, payout_currency")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const profileInput = z.object({
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  country_iso: z.string().length(2).optional().nullable(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        country_iso: data.country_iso || null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const payoutInput = z.object({
  mobile_money_operator: z.enum(["ORANGE", "MTN", "WAVE", "MOOV", "AIRTEL"]).nullable(),
  mobile_money_number: z.string().min(6).max(20).regex(/^\+?[0-9 ]+$/, "Numéro invalide").nullable(),
  mobile_money_holder_name: z.string().min(2).max(120).nullable(),
  payout_currency: z.enum(["XOF", "XAF", "NGN", "KES", "GHS", "MAD", "RWF", "EGP", "ZAR", "CDF", "BIF", "UGX", "TZS", "ETB", "ZMW", "MZN", "MGA", "TND", "DZD", "LYD"]).nullable().optional(),
});

export const updatePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => payoutInput.parse(d))
  .handler(async ({ data, context }) => {
    const patch = {
      mobile_money_operator: data.mobile_money_operator,
      mobile_money_number: data.mobile_money_number,
      mobile_money_holder_name: data.mobile_money_holder_name,
      ...(data.payout_currency !== undefined ? { payout_currency: data.payout_currency } : {}),
    };
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
