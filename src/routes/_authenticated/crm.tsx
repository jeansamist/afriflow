import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Pencil, Phone, Link2, Sparkles, Copy } from "lucide-react";
import { listClientsWithStats, upsertClient, deleteClient, seedDemoData } from "@/utils/crm.functions";
import { createPaymentLink } from "@/utils/payments.functions";
import { getRate, SUPPORTED_INVOICE } from "@/utils/fx.functions";
import { paymentFeeBreakdown, paymentFeeLabel } from "@/lib/payment-fees";
import { getDashboardData } from "@/utils/dashboard.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "Clients · AfriFlow" }] }),
  validateSearch: (s: Record<string, unknown>) =>
    z.object({
      newContactPhone: z.string().optional(),
      newContactName: z.string().optional(),
    }).parse(s),
  component: CrmPage,
});


type ClientRow = Awaited<ReturnType<typeof listClientsWithStats>>[number];

function CrmPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const fetchClients = useServerFn(listClientsWithStats);
  const saveClient = useServerFn(upsertClient);
  const removeClient = useServerFn(deleteClient);
  const seed = useServerFn(seedDemoData);
  const createLink = useServerFn(createPaymentLink);
  const fetchDash = useServerFn(getDashboardData);

  const { data: clients = [], isLoading } = useQuery({ queryKey: ["crm-clients-stats"], queryFn: () => fetchClients() });
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDash() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [payClient, setPayClient] = useState<ClientRow | null>(null);
  const [prefill, setPrefill] = useState<{ contact_phone?: string; contact_name?: string } | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(clients.length / PAGE_SIZE));
  const pagedClients = clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Auto-open New Contact dialog when called from a call log
  useEffect(() => {
    if (search.newContactPhone) {
      setPrefill({ contact_phone: search.newContactPhone, contact_name: search.newContactName ?? "" });
      setEditing(null);
      setOpen(true);
      navigate({ to: "/crm", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.newContactPhone, search.newContactName]);


  const saveMut = useMutation({
    mutationFn: (input: { id?: string; contact_name: string; company_name?: string | null; contact_email?: string | null; contact_phone?: string | null; notes?: string | null }) => saveClient({ data: input }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-clients-stats"] }); setOpen(false); setEditing(null); toast.success("Client enregistré"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => removeClient({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-clients-stats"] }); toast.success("Client supprimé"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const seedMut = useMutation({
    mutationFn: () => seed(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["crm-clients-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(r.skipped ? "Données déjà présentes." : "Données de démo chargées.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const callClient = (c: ClientRow) => {
    if (!c.contact_phone) return toast.error("Aucun numéro pour ce client.");
    navigate({ to: "/phone", search: { dial: c.contact_phone, client: c.id } });
  };

  const createPayMut = useMutation({
    mutationFn: (input: { amount: number; currency: string; description: string; clientId: string }) =>
      createLink({ data: input }),
    onSuccess: async (r) => {
      const url = `${window.location.origin}/pay/${r.id}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      qc.invalidateQueries({ queryKey: ["crm-clients-stats"] });
      setPayClient(null);
      toast.success("Lien créé et copié");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-surface/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Tableau de bord
          </Link>
          <div className="flex items-center gap-2">
            {clients.length === 0 && (
              <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
                <Sparkles className="h-4 w-4" /> Charger des données de démo
              </Button>
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setPrefill(null); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditing(null); setPrefill(null); }}><Plus className="h-4 w-4" /> Nouveau client</Button>
              </DialogTrigger>
              <ClientDialog key={`${editing?.id ?? "new"}-${prefill?.contact_phone ?? ""}`} client={editing} prefill={prefill} onSave={(v) => saveMut.mutate(v)} saving={saveMut.isPending} />
            </Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="text-2xl font-bold">Mes clients</h1>
        <p className="text-sm text-muted-foreground">Vos clients à l'étranger : appelez-les et envoyez un lien de paiement en un clic.</p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : clients.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>Aucun client pour l'instant.</p>
              <p className="mt-2 text-sm">Créez votre premier client ou chargez des données de démo pour explorer.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Dernier appel</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedClients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.contact_name}</div>
                      {c.company_name && <div className="text-xs text-muted-foreground">{c.company_name}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.contact_phone ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastCall ? (
                        <>
                          <span>{new Date(c.lastCall.created_at).toLocaleDateString("fr-FR")}</span>
                          <span className="ml-2 text-foreground/80">{c.lastCall.duration_seconds}s</span>
                          <div className="text-[10px] uppercase">{c.callsCount} appel(s)</div>
                        </>
                      ) : "Jamais"}
                    </TableCell>
                    <TableCell>
                      {c.lastPayment ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{Number(c.lastPayment.amount).toFixed(2)} {c.lastPayment.currency}</span>
                          <PayBadge status={c.lastPayment.status} />
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Appeler" onClick={() => callClient(c)} disabled={!c.contact_phone}>
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Lien de paiement" onClick={() => setPayClient(c)}>
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Modifier" onClick={() => { setEditing(c); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Supprimer" onClick={() => { if (confirm("Supprimer ce client ?")) delMut.mutate(c.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          )}
          {clients.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t border-border p-4 text-xs text-muted-foreground">
              <span>Page {page} sur {totalPages} · {clients.length} client(s)</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Précédent</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Suivant</Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* PAYMENT LINK DIALOG */}
      <Dialog open={!!payClient} onOpenChange={(o) => { if (!o) setPayClient(null); }}>
        {payClient && (
          <PaymentDialog client={payClient} payoutCurrency={dash?.counts.payoutCurrency ?? "XOF"} onSubmit={(v) => createPayMut.mutate({ ...v, clientId: payClient.id })} submitting={createPayMut.isPending} />
        )}
      </Dialog>
    </div>
  );
}

function PayBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PAID: { label: "Payé", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    GENERATED: { label: "En attente", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
    EXPIRED: { label: "Expiré", cls: "border-red-500/30 bg-red-500/10 text-red-300" },
    CANCELLED: { label: "Annulé", cls: "border-red-500/30 bg-red-500/10 text-red-300" },
  };
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function ClientDialog({ client, prefill, onSave, saving }: { client: ClientRow | null; prefill?: { contact_phone?: string; contact_name?: string } | null; onSave: (v: { id?: string; contact_name: string; company_name?: string | null; contact_email?: string | null; contact_phone?: string | null; notes?: string | null }) => void; saving: boolean }) {
  const [form, setForm] = useState({
    contact_name: client?.contact_name ?? prefill?.contact_name ?? "",
    company_name: client?.company_name ?? "",
    contact_email: client?.contact_email ?? "",
    contact_phone: client?.contact_phone ?? prefill?.contact_phone ?? "",
    notes: client?.notes ?? "",
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{client ? "Modifier le client" : "Nouveau client"}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div><Label>Nom du contact *</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
        <div><Label>Société</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
          <div><Label>Téléphone international</Label><Input placeholder="+33..." value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button disabled={!form.contact_name || saving} onClick={() => onSave({ id: client?.id, ...form })}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PaymentDialog({
  client, payoutCurrency, onSubmit, submitting,
}: {
  client: ClientRow;
  payoutCurrency: string;
  onSubmit: (v: { amount: number; currency: string; description: string }) => void;
  submitting: boolean;
}) {
  const [amount, setAmount] = useState("100");
  const [currency, setCurrency] = useState<string>("EUR");
  const [description, setDescription] = useState(`Prestation pour ${client.company_name ?? client.contact_name}`);
  const fetchRate = useServerFn(getRate);
  const [rate, setRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!currency || !payoutCurrency || currency === payoutCurrency) {
      setRate(currency === payoutCurrency ? 1 : null);
      return;
    }
    setLoadingRate(true);
    fetchRate({ data: { base: currency, quote: payoutCurrency } })
      .then((r) => { if (!cancelled) setRate(r.rate); })
      .catch(() => { if (!cancelled) setRate(null); })
      .finally(() => { if (!cancelled) setLoadingRate(false); });
    return () => { cancelled = true; };
  }, [currency, payoutCurrency, fetchRate]);

  const amt = Number(amount) || 0;
  const { fee, net } = amt > 0 ? paymentFeeBreakdown(amt, currency) : { fee: 0, net: 0 };
  const netLocal = rate ? Math.round(net * rate * 100) / 100 : null;
  const fmt = (n: number, c: string) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Lien de paiement pour {client.contact_name}</DialogTitle>
        <DialogDescription>Le lien sera copié dans votre presse-papier — envoyez-le par email ou WhatsApp.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Montant</Label>
            <Input type="number" step="0.01" min="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100.00" />
          </div>
          <div>
            <Label>Devise (votre client paie)</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED_INVOICE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {amt > 0 && (
          <div className="mt-2 rounded-xl border border-border bg-surface-elevated p-4 text-sm">
            <Row label="Votre client paie" value={fmt(amt, currency)} bold />
            <Row label={`Frais de transaction (${paymentFeeLabel(currency)})`} value={`− ${fmt(fee, currency)}`} muted />
            <div className="my-2 border-t border-border/60" />
            <Row label="Vous recevez (net)" value={fmt(net, currency)} bold />
            {payoutCurrency !== currency && (
              <>
                <Row
                  label="Taux de change"
                  value={loadingRate ? "…" : rate ? `1 ${currency} = ${rate.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${payoutCurrency}` : "—"}
                  muted
                />
                <Row
                  label={`Crédité sur votre Mobile Money`}
                  value={netLocal ? `${Math.round(netLocal).toLocaleString("fr-FR")} ${payoutCurrency}` : "—"}
                  bold
                  highlight
                />
              </>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button disabled={!amount || !description || submitting} onClick={() => onSubmit({ amount: amt, currency, description })}>
          <Copy className="h-4 w-4" /> {submitting ? "Création…" : "Générer et copier"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Row({ label, value, bold, muted, highlight }: { label: string; value: string; bold?: boolean; muted?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${muted ? "text-muted-foreground" : ""}`}>
      <span className="text-xs">{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${highlight ? "text-emerald-400" : ""}`}>{value}</span>
    </div>
  );
}

