/**
 * Server-side helper to send auth emails via Resend.
 * Auth emails (confirmation, reset password) are time-critical: they are sent
 * directly (no pgmq queue) and bypass the suppression/unsubscribe pipeline.
 */
import { render } from "@react-email/components";
import * as React from "react";
import { Resend } from "resend";

const DEFAULT_FROM = "AfriFlow <noreply@afriflow.tech>";

let _resend: Resend | undefined;

export function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Missing RESEND_API_KEY environment variable.");
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export type SendAuthEmailArgs<P extends object> = {
  to: string;
  subject: string;
  component: React.ComponentType<P>;
  props?: P;
};

export async function sendAuthEmail<P extends object>({
  to,
  subject,
  component,
  props,
}: SendAuthEmailArgs<P>) {
  const element = React.createElement(component, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const { data, error } = await getResend().emails.send({
    from: process.env.RESEND_FROM || DEFAULT_FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error("[resend] auth email send failed:", error);
    return { ok: false as const, reason: error.message };
  }
  return { ok: true as const, id: data?.id };
}
