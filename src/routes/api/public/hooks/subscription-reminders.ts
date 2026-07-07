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
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const buckets: Array<{ label: "3d" | "2d" | "1d" | "0"; days: number; template: string }> =
          [
            { label: "3d", days: 3, template: "subscription-expiring-3d" },
            { label: "2d", days: 2, template: "subscription-expiring-2d" },
            { label: "1d", days: 1, template: "subscription-expiring-1d" },
            { label: "0", days: 0, template: "subscription-expired" },
          ];

        const summary: Record<string, number> = {};

        for (const bucket of buckets) {
          const { start, end } = dayBoundsUtc(bucket.days);
          // J0 = wallets whose cycle already ended today (RESTRICTED) OR ACTIVE expiring today
          const statusFilter = bucket.days === 0 ? ["ACTIVE", "RESTRICTED"] : ["ACTIVE"];

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
              "2d": ["Abonnement Pro — J-2", "Renouvellement dans 2 jours."],
              "1d": ["Abonnement Pro — Demain", "Dernière chance avant expiration."],
              "0": ["Abonnement Pro expiré", "Réactivez votre numéro via Mobile Money."],
            };
            const [title, body] = titles[bucket.label];
            await notifyOwner(admin, userId, "SUBSCRIPTION_REMINDER", title, body);
            count++;
          }
          summary[bucket.label] = count;
        }

        // ── Number deallocation: numbers whose plan expired > RELEASE_AFTER_DAYS
        // ago are released (Twilio included, to stop rental fees). A warning is
        // sent WARN_BEFORE_DAYS before release.
        const RELEASE_AFTER_DAYS = 30;
        const WARN_BEFORE_DAYS = 3;
        const now = Date.now();
        const DAY = 24 * 3600 * 1000;
        // Warn once, on the day exactly WARN_BEFORE_DAYS before release.
        const warnDay = dayBoundsUtc(WARN_BEFORE_DAYS);
        const warnDayStart = new Date(warnDay.start).getTime();
        const warnDayEnd = new Date(warnDay.end).getTime();
        let releasedCount = 0;
        let warnedCount = 0;

        const { data: allocations } = await admin
          .from("phone_allocations")
          .select("id, user_id, e164, twilio_sid, provider, status, created_at")
          .in("status", ["ACTIVE", "RESERVED"]);

        for (const alloc of allocations || []) {
          const a = alloc as {
            id: string;
            user_id: string;
            e164: string;
            twilio_sid: string | null;
            provider: string;
            status: string;
            created_at: string;
          };

          const { data: wallet } = await admin
            .from("phone_wallets")
            .select("plan_status, cycle_ends_at, trial_ends_at")
            .eq("user_id", a.user_id)
            .maybeSingle();
          const w = wallet as {
            plan_status: string;
            cycle_ends_at: string | null;
            trial_ends_at: string | null;
          } | null;

          // Only accounts without a running plan are candidates.
          if (!w || w.plan_status === "ACTIVE" || w.plan_status === "TRIAL") continue;

          // Expiry reference: end of last Pro cycle, else end of trial, else
          // the reservation date (accounts that never subscribed).
          const expiryRef = w.cycle_ends_at ?? w.trial_ends_at ?? a.created_at;
          const releaseAt = new Date(expiryRef).getTime() + RELEASE_AFTER_DAYS * DAY;

          const { data: userInfo } = await admin.auth.admin.getUserById(a.user_id);
          const email = userInfo?.user?.email;
          const { data: profile } = await admin
            .from("profiles")
            .select("first_name")
            .eq("id", a.user_id)
            .maybeSingle();
          const firstName = (profile as { first_name?: string } | null)?.first_name;

          if (now >= releaseAt) {
            // Release on Twilio first — if that fails, retry tomorrow rather
            // than orphaning a number we keep paying for.
            if (a.twilio_sid && a.provider === "TWILIO") {
              try {
                const { releasePhoneNumber } = await import("@/lib/twilio.server");
                await releasePhoneNumber(a.twilio_sid);
              } catch (e) {
                console.error(
                  `[dealloc] Twilio release failed for ${a.e164} (${a.twilio_sid}) — will retry:`,
                  (e as Error).message,
                );
                continue;
              }
            }

            await admin.from("phone_allocations").update({ status: "RELEASED" }).eq("id", a.id);
            await admin
              .from("profiles")
              .update({ allocated_phone_number: null, phone_onboarding_completed: false })
              .eq("id", a.user_id);
            await admin
              .from("phone_subscriptions" as any)
              .update({ status: "CANCELLED" })
              .eq("phone_allocation_id", a.id);

            if (email) {
              await sendAppEmail({
                templateName: "number-released",
                recipientEmail: email,
                idempotencyKey: `number-released-${a.id}`,
                templateData: { firstName, phoneNumber: a.e164 },
              });
            }
            await notifyOwner(
              admin,
              a.user_id,
              "NUMBER_RELEASED",
              "Numéro libéré",
              `Votre numéro ${a.e164} a été retiré de votre compte après un mois sans abonnement.`,
            );
            console.info(`[dealloc] ✓ released ${a.e164} (user ${a.user_id})`);
            releasedCount++;
          } else if (releaseAt >= warnDayStart && releaseAt < warnDayEnd) {
            if (email) {
              await sendAppEmail({
                templateName: "number-release-warning",
                recipientEmail: email,
                // One warning per allocation (idempotent across daily runs).
                idempotencyKey: `number-release-warning-${a.id}`,
                templateData: {
                  firstName,
                  phoneNumber: a.e164,
                  releaseDate: new Date(releaseAt).toLocaleDateString("fr-FR"),
                },
              });
            }
            await notifyOwner(
              admin,
              a.user_id,
              "NUMBER_RELEASE_WARNING",
              "Votre numéro sera libéré dans 3 jours",
              `Renouvelez votre plan Pro avant le ${new Date(releaseAt).toLocaleDateString("fr-FR")} pour conserver ${a.e164}.`,
            );
            warnedCount++;
          }
        }

        summary["dealloc_warned"] = warnedCount;
        summary["dealloc_released"] = releasedCount;

        return Response.json({ ok: true, summary });
      },
    },
  },
});
