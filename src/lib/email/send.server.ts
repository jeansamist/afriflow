/**
 * Server-side helper to send a transactional email from a server function.
 * Renders a React Email template and enqueues it via the email pgmq pipeline.
 */
import { TEMPLATES } from "@/lib/email-templates/registry";
import { render } from "@react-email/components";
import * as React from "react";

const SITE_NAME = "smooth-dev-stream";
const SENDER_DOMAIN = "notify.afriflow.tech";
const FROM_DOMAIN = "notify.afriflow.tech";

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
  templateData?: Record<string, any>;
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

  await admin.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: "pending",
  });

  const { error } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text: plainText,
      purpose: "transactional",
      label: templateName,
      idempotency_key: idempotencyKey || messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (error) {
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "failed",
      error_message: error.message,
    });
    return { ok: false, reason: error.message };
  }

  return { ok: true, queued: true, messageId };
}
