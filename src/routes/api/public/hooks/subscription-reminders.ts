import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendAppEmail } from "@/lib/email/send.server";

function dayBoundsUtc(daysFromToday: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + daysFromToday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function notifyOwner(admin: any, userId: string, type: string, title: string, body: string) {
  await admin.from("in_app_notifications").insert({
    user_id: userId,
    type,
    title,
    body,
  });
}

export const Route = createFileRoute("/api/public/hooks/subscription-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );

        const buckets: Array<{ label: "3d" | "1d" | "0"; days: number; template: string }> = [
          { label: "3d", days: 3, template: "subscription-expiring-3d" },
          { label: "1d", days: 1, template: "subscription-expiring-1d" },
          { label: "0", days: 0, template: "subscription-expired" },
        ];

        const summary: Record<string, number> = {};

        for (const bucket of buckets) {
          const { start, end } = dayBoundsUtc(bucket.days);
          // J0 = wallets whose cycle already ended today (RESTRICTED) OR ACTIVE expiring today
          const statusFilter =
            bucket.days === 0 ? ["ACTIVE", "RESTRICTED"] : ["ACTIVE"];

          const { data: wallets } = await admin
            .from("phone_wallets")
            .select("user_id, cycle_ends_at, plan_status")
            .in("plan_status", statusFilter)
            .gte("cycle_ends_at", start)
            .lt("cycle_ends_at", end);

          let count = 0;
          for (const w of wallets || []) {
            const userId = (w as any).user_id as string;
            const cycleEnd = (w as any).cycle_ends_at as string;
            const idem = `subreminder-${bucket.label}-${userId}-${cycleEnd.slice(0, 10)}`;

            // Resolve email + first name
            const { data: userInfo } = await admin.auth.admin.getUserById(userId);
            const email = userInfo?.user?.email;
            const { data: profile } = await admin
              .from("profiles")
              .select("first_name")
              .eq("id", userId)
              .maybeSingle();

            if (email) {
              await sendAppEmail({
                templateName: bucket.template,
                recipientEmail: email,
                idempotencyKey: idem,
                templateData: {
                  firstName: (profile as any)?.first_name,
                  endsAt: new Date(cycleEnd).toLocaleDateString("fr-FR"),
                },
              });
            }

            const titles: Record<string, [string, string]> = {
              "3d": ["Abonnement Pro — J-3", "Renouvellement dans 3 jours."],
              "1d": ["Abonnement Pro — Demain", "Dernière chance avant expiration."],
              "0": ["Abonnement Pro expiré", "Réactivez votre numéro via Mobile Money."],
            };
            const [title, body] = titles[bucket.label];
            await notifyOwner(admin, userId, "SUBSCRIPTION_REMINDER", title, body);
            count++;
          }
          summary[bucket.label] = count;
        }

        return Response.json({ ok: true, summary });
      },
    },
  },
});
