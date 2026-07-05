import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const clientInput = z.object({
  id: z.string().uuid().optional(),
  contact_name: z.string().min(1),
  company_name: z.string().optional().nullable(),
  contact_email: z.string().email().optional().or(z.literal("")).nullable(),
  contact_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("crm_clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Returns clients enriched with last call + last payment status.
 * Aggregated client-side from a single user-scoped fetch (RLS filters).
 */
export const listClientsWithStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [clientsRes, callsRes, paymentsRes] = await Promise.all([
      supabase.from("crm_clients").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("call_logs").select("client_id, created_at, duration_seconds, direction, status")
        .eq("user_id", userId).not("client_id", "is", null).order("created_at", { ascending: false }),
      supabase.from("payment_links").select("client_id, amount, currency, status, created_at")
        .eq("user_id", userId).not("client_id", "is", null).order("created_at", { ascending: false }),
    ]);
    if (clientsRes.error) throw new Error(clientsRes.error.message);

    const calls = callsRes.data ?? [];
    const payments = paymentsRes.data ?? [];

    return (clientsRes.data ?? []).map((c) => {
      const cCalls = calls.filter((x) => x.client_id === c.id);
      const cPayments = payments.filter((x) => x.client_id === c.id);
      const lastCall = cCalls[0] ?? null;
      const lastPayment = cPayments[0] ?? null;
      const paidTotal = cPayments
        .filter((p) => p.status === "PAID")
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        ...c,
        callsCount: cCalls.length,
        lastCall,
        lastPayment,
        paidTotal,
        currency: cPayments[0]?.currency ?? "EUR",
      };
    });
  });

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clientInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      contact_name: data.contact_name,
      company_name: data.company_name || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      notes: data.notes || null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("crm_clients").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("crm_clients").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Seeds demo clients + call history + payment links for the current user.
 * Idempotent-ish: only seeds if user has fewer than 2 clients.
 */
export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { count } = await supabase
      .from("crm_clients").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if ((count ?? 0) >= 2) return { ok: true, skipped: true };

    const demoClients = [
      { contact_name: "Camille Laurent", company_name: "Studio Laurent · Paris", contact_email: "camille@studiolaurent.fr", contact_phone: "+33612345678", notes: "Agence design — refonte site vitrine." },
      { contact_name: "Marc Tremblay", company_name: "Tremblay Tech · Montréal", contact_email: "marc@tremblay.ca", contact_phone: "+15145550199", notes: "Développement d'un module SaaS, paiement en CAD." },
      { contact_name: "Sofia Rossi", company_name: "Rossi & Co · Milan", contact_email: "sofia@rossi.it", contact_phone: "+393331234567", notes: "Mission de conseil mensuelle." },
      { contact_name: "Hans Müller", company_name: "Müller GmbH · Berlin", contact_email: "hans@muller.de", contact_phone: "+4915123456789", notes: "Mandat de community management." },
    ];

    const { data: inserted, error: cErr } = await supabase
      .from("crm_clients")
      .insert(demoClients.map((c) => ({ ...c, user_id: userId })))
      .select();
    if (cErr) throw new Error(cErr.message);
    const clients = inserted ?? [];

    // Need an allocation to keep call_logs consistent — fallback to a fake
    const { data: alloc } = await supabase
      .from("phone_allocations").select("e164").eq("user_id", userId).eq("status", "ACTIVE").maybeSingle();
    const myNumber = alloc?.e164 ?? "+237600000000";

    const now = Date.now();
    type CallInsert = {
      user_id: string; client_id: string; twilio_call_sid: string;
      from_number: string; to_number: string; direction: string;
      status: string; duration_seconds: number; cost_credits: number; created_at: string;
    };
    type PaymentInsert = {
      user_id: string; client_id: string; amount: number; currency: string;
      description: string; status: "PAID" | "GENERATED" | "EXPIRED" | "CANCELLED"; created_at: string;
    };
    const calls: CallInsert[] = [];
    const payments: PaymentInsert[] = [];

    clients.forEach((cl, idx) => {
      const n = 2 + (idx % 2);
      for (let i = 0; i < n; i++) {
        const outbound = (i + idx) % 2 === 0;
        const status = i === 0 ? "completed" : ["completed", "no-answer", "completed"][i % 3];
        const dur = status === "completed" ? 90 + Math.floor(Math.random() * 600) : 0;
        const daysAgo = i * 2 + idx;
        calls.push({
          user_id: userId,
          client_id: cl.id,
          twilio_call_sid: `SIM-DEMO-${cl.id.slice(0, 6)}-${i}`,
          from_number: outbound ? myNumber : (cl.contact_phone ?? "+330000000000"),
          to_number: outbound ? (cl.contact_phone ?? "+330000000000") : myNumber,
          direction: outbound ? "OUTBOUND" : "INBOUND",
          status,
          duration_seconds: dur,
          cost_credits: Number((dur * 0.02).toFixed(2)),
          created_at: new Date(now - daysAgo * 86400000 - i * 3600000).toISOString(),
        });
      }
      const amounts = [350, 1200, 480, 950];
      const statuses: Array<"PAID" | "GENERATED"> = ["PAID", "GENERATED", "PAID", "PAID"];
      payments.push({
        user_id: userId,
        client_id: cl.id,
        amount: amounts[idx % amounts.length],
        currency: idx === 1 ? "CAD" : "EUR",
        description: `Prestation pour ${cl.company_name ?? cl.contact_name}`,
        status: statuses[idx % statuses.length],
        created_at: new Date(now - idx * 3 * 86400000).toISOString(),
      });
    });

    if (calls.length) {
      const { error } = await supabase.from("call_logs").insert(calls);
      if (error) throw new Error(error.message);
    }
    if (payments.length) {
      const { error } = await supabase.from("payment_links").insert(payments);
      if (error) throw new Error(error.message);
    }
    return { ok: true, clients: clients.length, calls: calls.length, payments: payments.length };
  });
