/**
 * Server-side helper to send a transactional email from a server function.
 * Renders a React Email template and sends it directly via Resend.
 * (The old pgmq/Lovable queue pipeline is bypassed: it required a pg_cron job
 * and LOVABLE_API_KEY that are not provisioned, so messages stayed pending.)
 */
import { TEMPLATES } from "@/lib/email-templates/registry";
import { getResend } from "@/lib/email/resend.server";
import { render } from "@react-email/components";
import * as React from "react";

const DEFAULT_FROM = "AfriFlow <noreply@afriflow.tech>";
const FALLBACK_APP_URL = "https://afriflow.tech";

/** Public origin used to build unsubscribe links (works outside a request too). */
async function resolveAppOrigin(): Promise<string> {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    return new URL(getRequest().url).origin;
  } catch {
    return FALLBACK_APP_URL;
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type SendAppEmailArgs = {
  templateName: string;
  recipientEmail: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
};

/**
 * Render + enqueue an app email server-side (no HTTP roundtrip).
 * Returns `{ ok: true, queued }` or `{ ok: false, reason }`.
 */
export async function sendAppEmail(args: SendAppEmailArgs) {
  const { templateName, recipientEmail, templateData = {}, idempotencyKey } = args;
  const template = TEMPLATES[templateName];
  if (!template) return { ok: false, reason: `template_not_found:${templateName}` };

  const effectiveRecipient = template.to || recipientEmail;
  if (!effectiveRecipient) return { ok: false, reason: "missing_recipient" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin;
  const messageId = crypto.randomUUID();
  const normalized = effectiveRecipient.toLowerCase();

  // Suppression check
  const { data: suppressed } = await admin
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (suppressed) {
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "suppressed",
    });
    return { ok: false, reason: "email_suppressed" };
  }

  // Unsubscribe token (reuse or create)
  let unsubscribeToken: string;
  const { data: existing } = await admin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token;
  } else if (!existing) {
    unsubscribeToken = generateToken();
    await admin
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: normalized },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await admin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalized)
      .maybeSingle();
    unsubscribeToken = stored?.token ?? unsubscribeToken;
  } else {
    return { ok: false, reason: "email_suppressed" };
  }

  // Render
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const plainText = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  // Send directly via Resend (RFC 8058 one-click unsubscribe headers)
  const origin = await resolveAppOrigin();
  const unsubscribeUrl = `${origin}/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

  const { data: sendRes, error } = await getResend().emails.send({
    from: process.env.RESEND_FROM || DEFAULT_FROM,
    to: effectiveRecipient,
    subject,
    html,
    text: plainText,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      ...(idempotencyKey ? { "X-Entity-Ref-ID": idempotencyKey } : {}),
    },
  });

  await admin.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: error ? "failed" : "sent",
    error_message: error ? error.message : null,
  });

  if (error) {
    console.error("[email] resend send failed", templateName, error);
    return { ok: false, reason: error.message };
  }

  return { ok: true, queued: false, messageId, resendId: sendRes?.id };
}
