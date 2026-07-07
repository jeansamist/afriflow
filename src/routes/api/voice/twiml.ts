import { createFileRoute } from "@tanstack/react-router";

// Twilio calls this URL when device.connect() is called (TwiML App Voice URL).
// POST body (form-encoded): To, From (identity), callerId, CallSid, AccountSid…
export const Route = createFileRoute("/api/voice/twiml")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Use text() + URLSearchParams to avoid undici's strict Content-Type check
        // on formData() — Twilio may send charset or other parameters that break it.
        const text = await request.text();
        const params = new URLSearchParams(text);
        const to = params.get("To");
        const callerId = params.get("callerId");
        const from = params.get("From"); // "client:<userId>" for browser-originated calls

        // Outbound calls are reserved for KYC-approved accounts.
        const identity = from?.startsWith("client:") ? from.slice("client:".length) : null;
        if (!identity) {
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`,
            { headers: { "Content-Type": "text/xml" } },
          );
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("kyc_status")
          .eq("id", identity)
          .maybeSingle();
        if ((profile as { kyc_status: string | null } | null)?.kyc_status !== "APPROVED") {
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-FR">Les appels sortants sont réservés aux comptes vérifiés. Complétez votre vérification d'identité.</Say><Hangup/></Response>`,
            { headers: { "Content-Type": "text/xml" } },
          );
        }

        if (!to) {
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Missing destination number.</Say></Response>`,
            { headers: { "Content-Type": "text/xml" } },
          );
        }

        // Sanitise: only allow E.164 format (+digits) to prevent open relay abuse
        const e164 = /^\+[1-9]\d{6,14}$/.test(to) ? to : null;
        if (!e164) {
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid destination.</Say></Response>`,
            { headers: { "Content-Type": "text/xml" } },
          );
        }

        const callerIdAttr = callerId ? ` callerId="${callerId}"` : "";
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${callerIdAttr} timeout="30" record="do-not-record">
    <Number>${e164}</Number>
  </Dial>
</Response>`;

        return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
      },
    },
  },
});
