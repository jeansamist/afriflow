/**
 * Server-only helper to email every admin (user_roles.role = 'admin')
 * through the Resend transactional pipeline (sendAppEmail).
 */
import { sendAppEmail } from "@/lib/email/send.server";

export type AdminEmailArgs = {
  templateName: string;
  templateData?: Record<string, unknown>;
  /** Per-admin idempotency key becomes `${idempotencyPrefix}-${adminUserId}`. */
  idempotencyPrefix?: string;
};

export async function sendAdminEmails(args: AdminEmailArgs) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: admins, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (error) {
    console.error("[admin-email] roles lookup failed", error);
    return { ok: false as const, sent: 0 };
  }
  if (!admins?.length) return { ok: true as const, sent: 0 };

  const adminIds = new Set(admins.map((r: { user_id: string }) => r.user_id));
  const { data: usersRes, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 200,
  });
  if (usersErr) {
    console.error("[admin-email] listUsers failed", usersErr);
    return { ok: false as const, sent: 0 };
  }

  const recipients = (usersRes?.users ?? [])
    .filter((u) => adminIds.has(u.id) && u.email)
    .map((u) => ({ id: u.id, email: u.email as string }));

  let sent = 0;
  await Promise.all(
    recipients.map(async ({ id, email }) => {
      const res = await sendAppEmail({
        templateName: args.templateName,
        recipientEmail: email,
        templateData: args.templateData,
        idempotencyKey: args.idempotencyPrefix ? `${args.idempotencyPrefix}-${id}` : undefined,
      });
      if (res.ok) sent += 1;
      else console.warn("[admin-email] not sent", args.templateName, email, res.reason);
    }),
  );
  return { ok: true as const, sent };
}
