/**
 * Server-only helper to push in-app notifications.
 * Uses the service-role client to bypass RLS (the column-level grants on the
 * table block any direct INSERT from authenticated users).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationKind =
  | "PAYMENT_PAID"
  | "PAYOUT_SENT"
  | "PAYOUT_FAILED"
  | "NUMBER_ACTIVATED"
  | "LOW_MINUTES"
  | "TRIAL_EXPIRING"
  | "KYC_UPDATE"
  | "PRO_ACTIVATED"
  | "ADMIN_ALERT";

export type NotificationInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  linkTo?: string;
  metadata?: Record<string, unknown>;
};

export async function pushNotification(
  admin: SupabaseClient<any, any, any> | null,
  input: NotificationInput,
) {
  const client =
    admin ??
    (await (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
    })());

  const { error } = await client.from("in_app_notifications").insert({
    user_id: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    link_to: input.linkTo ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) console.error("[notifications] push failed", error);
}

/** Notify every user holding the given role (e.g. all admins). */
export async function pushAdminNotification(input: Omit<NotificationInput, "userId">) {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: admins } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (!admins?.length) return;
  await Promise.all(
    admins.map((row: any) => pushNotification(admin, { ...input, userId: row.user_id })),
  );
}
