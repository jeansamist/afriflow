import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { SUPPORTED_COUNTRY_ISOS } from "@/lib/countries";

const signUpSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  country: z.enum(SUPPORTED_COUNTRY_ISOS),
});

const emailSchema = z.object({ email: z.string().trim().email().max(255) });

// Best-effort per-instance cooldown so the public endpoints can't be used to
// spam a mailbox / burn the Resend quota.
const COOLDOWN_MS = 60_000;
const lastSentAt = new Map<string, number>();
function onCooldown(email: string): boolean {
  const now = Date.now();
  const last = lastSentAt.get(email);
  if (last && now - last < COOLDOWN_MS) return true;
  lastSentAt.set(email, now);
  return false;
}

function requestOrigin(): string {
  return new URL(getRequest().url).origin;
}

function isUserNotFound(error: { code?: string; status?: number; message: string }): boolean {
  return error.code === "user_not_found" || error.status === 404;
}

/**
 * Creates the account (unconfirmed) and sends the confirmation email via Resend.
 * Replaces supabase.auth.signUp so the email no longer depends on Supabase's built-in mailer.
 */
export const signUpWithEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signUpSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendAuthEmail } = await import("@/lib/email/resend.server");
    const { template } = await import("@/lib/email-templates/auth-confirm-signup");

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email: data.email,
      password: data.password,
      options: {
        redirectTo: `${requestOrigin()}/dashboard`,
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          country_iso: data.country,
        },
      },
    });

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "email_exists" || /already.*registered/i.test(error.message)) {
        return { ok: false as const, code: "user_exists" as const };
      }
      console.error("[auth] signup link generation failed:", error.message);
      return { ok: false as const, code: "signup_failed" as const };
    }

    const sent = await sendAuthEmail({
      to: data.email,
      subject: template.subject,
      component: template.component,
      props: { firstName: data.firstName, actionUrl: link.properties.action_link },
    });
    if (!sent.ok) return { ok: false as const, code: "email_failed" as const };
    return { ok: true as const };
  });

/**
 * Re-sends a confirmation link (as a magic link — verifying it confirms the
 * email and signs the user in). Always returns ok for unknown emails.
 */
export const resendConfirmationEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => emailSchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    if (onCooldown(email)) return { ok: false as const, code: "cooldown" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendAuthEmail } = await import("@/lib/email/resend.server");
    const { template } = await import("@/lib/email-templates/auth-confirm-signup");

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${requestOrigin()}/dashboard` },
    });

    if (error) {
      if (isUserNotFound(error)) return { ok: true as const };
      console.error("[auth] confirmation resend failed:", error.message);
      return { ok: false as const, code: "email_failed" as const };
    }

    const sent = await sendAuthEmail({
      to: email,
      subject: template.subject,
      component: template.component,
      props: { actionUrl: link.properties.action_link },
    });
    if (!sent.ok) return { ok: false as const, code: "email_failed" as const };
    return { ok: true as const };
  });

/**
 * Sends a password-reset link via Resend. Always returns ok for unknown
 * emails so the endpoint can't be used to enumerate accounts.
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => emailSchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    if (onCooldown(email)) return { ok: false as const, code: "cooldown" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendAuthEmail } = await import("@/lib/email/resend.server");
    const { template } = await import("@/lib/email-templates/auth-reset-password");

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${requestOrigin()}/reset-password` },
    });

    if (error) {
      if (isUserNotFound(error)) return { ok: true as const };
      console.error("[auth] recovery link generation failed:", error.message);
      return { ok: false as const, code: "email_failed" as const };
    }

    const sent = await sendAuthEmail({
      to: email,
      subject: template.subject,
      component: template.component,
      props: { actionUrl: link.properties.action_link },
    });
    if (!sent.ok) return { ok: false as const, code: "email_failed" as const };
    return { ok: true as const };
  });
