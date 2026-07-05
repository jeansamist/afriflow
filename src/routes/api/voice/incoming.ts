import { createFileRoute } from "@tanstack/react-router";

// Twilio calls this URL when someone dials the user's Twilio number (set as the
// phone number's Voice URL — configured automatically at purchase and reconciled
// by getVoiceToken).
// POST body (form-encoded): To (Twilio number), From (caller), CallSid…
// We look up the owner of that number and connect the call to their browser client.
export const Route = createFileRoute("/api/voice/incoming")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Use text() + URLSearchParams to avoid undici's strict Content-Type check
        // on formData() — Twilio may send charset or other parameters that break it.
        const text = await request.text();
        const params = new URLSearchParams(text);
        const to = params.get("To"); // the Twilio number that was called
        const from = params.get("From");
        console.info("[voice/incoming] call", { to, from, callSid: params.get("CallSid") });

        let identity: string | null = null;

        if (to) {
          // Find the user who owns this number. phone_allocations covers every
          // provisioning path (paid checkout AND free onboarding allocation).
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("phone_allocations")
            .select("user_id")
            .eq("e164", to)
            .eq("status", "ACTIVE")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          identity = (data as { user_id: string } | null)?.user_id ?? null;
        }

        if (!identity) {
          console.warn("[voice/incoming] no active owner for", to);
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-FR">Ce numéro n'est pas disponible pour le moment.</Say></Response>`,
            { headers: { "Content-Type": "text/xml" } },
          );
        }

        // Ring the browser client registered with this identity (Twilio Device).
        // answerOnBridge keeps the caller hearing a ringtone until the user accepts.
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" timeout="30">
    <Client>${identity}</Client>
  </Dial>
  <Say language="fr-FR">Votre correspondant n'est pas disponible. Veuillez réessayer plus tard.</Say>
</Response>`;

        return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
      },
    },
  },
});
