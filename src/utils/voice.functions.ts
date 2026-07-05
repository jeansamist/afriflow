import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVoiceToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateVoiceToken } = await import("@/lib/twilio.voice.server");
    const token = generateVoiceToken(context.userId);
    const origin = new URL(getRequest().url).origin;

    // Reconcile the inbound webhook on the user's Twilio number so incoming
    // calls reach /api/voice/incoming (covers numbers purchased before this
    // was configured automatically). Non-blocking best effort.
    void (async () => {
      try {
        const { data: allocation } = await context.supabase
          .from("phone_allocations")
          .select("twilio_sid, provider")
          .eq("user_id", context.userId)
          .eq("status", "ACTIVE")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const alloc = allocation as { twilio_sid: string | null; provider: string } | null;
        if (alloc?.twilio_sid && alloc.provider === "TWILIO") {
          const { ensureInboundVoiceUrl } = await import("@/lib/twilio.server");
          await ensureInboundVoiceUrl(alloc.twilio_sid, origin);
        }
      } catch (e) {
        console.warn("[voice] inbound webhook reconcile failed:", (e as Error).message);
      }
    })();

    return { token };
  });
