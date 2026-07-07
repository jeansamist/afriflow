import { createServerFn } from "@tanstack/react-start";
import waitlistJson from "@/data/premium-waitlist.json";

function loadPremiumEmails(): Set<string> {
  const emails = (waitlistJson as { emails?: unknown }).emails;
  if (!Array.isArray(emails)) return new Set();
  return new Set(
    emails.filter((e): e is string => typeof e === "string").map((e) => e.toLowerCase().trim()),
  );
}

export const grantPremiumIfWaitlisted = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => {
    if (typeof d.email !== "string" || !d.email.includes("@")) throw new Error("Email invalide");
    return d;
  })
  .handler(async ({ data }) => {
    const premiumEmails = loadPremiumEmails();
    if (!premiumEmails.has(data.email.toLowerCase().trim())) return { granted: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const user = (userRes?.users ?? []).find(
      (u) => u.email?.toLowerCase() === data.email.toLowerCase().trim(),
    );
    if (!user) return { granted: false };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_premium: true })
      .eq("id", user.id);

    if (error) {
      console.error("[waitlist] failed to grant premium:", error.message);
      return { granted: false };
    }

    return { granted: true };
  });
