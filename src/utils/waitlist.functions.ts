import { createServerFn } from "@tanstack/react-start";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadPremiumEmails(): Set<string> {
  try {
    const raw = readFileSync(join(process.cwd(), "src/data/premium-waitlist.json"), "utf-8");
    const parsed = JSON.parse(raw) as { emails?: unknown };
    if (!Array.isArray(parsed.emails)) return new Set();
    return new Set((parsed.emails as unknown[]).filter((e): e is string => typeof e === "string").map((e) => e.toLowerCase().trim()));
  } catch {
    return new Set();
  }
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
    const user = (userRes?.users ?? []).find((u) => u.email?.toLowerCase() === data.email.toLowerCase().trim());
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
