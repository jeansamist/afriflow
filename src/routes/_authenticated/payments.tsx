import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { createPaymentLink, listPaymentLinks } from "@/utils/payments.functions";
import { listClients } from "@/utils/crm.functions";
import { getRate } from "@/utils/fx.functions";
import { paymentFeeBreakdown, paymentFeeLabel } from "@/lib/payment-fees";
import { getMyProfile } from "@/utils/settings.functions";
import { Copy, Plus, ExternalLink, User, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

type LinkRow = {
  id: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  created_at: string;
  client_id?: string | null;
  local_currency?: string | null;
  local_amount?: number | null;
  fx_rate?: number | null;
};

const INVOICE_CURRENCIES = ["EUR", "USD", "CAD"] as const;

const NONE = "__none__";

function PaymentsPage() {
  const createFn = useServerFn(createPaymentLink);
  const listFn = useServerFn(listPaymentLinks);
  const clientsFn = useServerFn(listClients);
  const rateFn = useServerFn(getRate);
  const profileFn = useServerFn(getMyProfile);

  const [rows, setRows] = useState<LinkRow[]>([]);
  const [clients, setClients] = useState<{ id: string; contact_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutCurrency, setPayoutCurrency] = useState<string>("XOF");
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [mmNumber, setMmNumber] = useState<string | null>(null);
  const [mmOperator, setMmOperator] = useState<string | null>(null);
  const [mmHolder, setMmHolder] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>(NONE);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [preview, setPreview] = useState<{ rate: number; source: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [r, c, p] = await Promise.all([listFn(), clientsFn(), profileFn()]);
      setRows(r as LinkRow[]);
      setClients(c as { id: string; contact_name: string }[]);
      const pc = p as {
        payout_currency?: string | null;
        mobile_money_number?: string | null;
        mobile_money_operator?: string | null;
        mobile_money_holder_name?: string | null;
        kyc_status?: string | null;
      } | null;
      if (pc?.payout_currency) setPayoutCurrency(pc.payout_currency);
      setKycStatus(pc?.kyc_status ?? null);
      setMmNumber(pc?.mobile_money_number ?? null);
      setMmOperator(pc?.mobile_money_operator ?? null);
      setMmHolder(pc?.mobile_money_holder_name ?? null);
    } catch (e: any) {
      toast.error(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Live FX preview as user types
  useEffect(() => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setPreview(null);
      return;
    }
    if (currency === payoutCurrency) {
      setPreview({ rate: 1, source: "same" });
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const { rate, source } = await rateFn({ data: { base: currency, quote: payoutCurrency } });
        if (!cancelled) setPreview({ rate, source });
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [amount, currency, payoutCurrency, rateFn]);

  // Western Union–style transfer breakdown
  const breakdown = useMemo(() => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !preview) return null;
    const { fee: feeInvoice, net: netInvoice } = paymentFeeBreakdown(amt, currency);
    const netLocal = Math.round(netInvoice * preview.rate * 100) / 100;
    return { feeInvoice, netInvoice, netLocal };
  }, [amount, currency, preview]);

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await createFn({
        data: {
          amount: Number(amount),
          currency,
          description,
          clientId: clientId !== NONE ? clientId : null,
        },
      });
      const url = `${window.location.origin}/pay/${result.id}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Lien créé et copié dans le presse-papier");
      setAmount("");
      setDescription("");
      setClientId(NONE);
      void refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${id}`);
    toast.success("Lien copié");
  };

  const statusVariant = (s: string) =>
    s === "PAID"
      ? "bg-primary/20 text-primary border-primary/30"
      : s === "EXPIRED" || s === "CANCELLED"
        ? "bg-red-500/10 text-red-300 border-red-500/30"
        : "bg-orange-500/10 text-orange-300 border-orange-500/30";

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display">Liens de paiement</h1>
            <p className="text-muted-foreground mt-1">
              Encaissez vos clients à l'étranger en EUR, USD, CAD… Reçu automatique envoyé.
            </p>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Tableau de bord
          </Link>
        </div>

        {!loading && kycStatus !== "APPROVED" && (
          <Card className="p-5 mb-8 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex-1">
                <span className="font-medium">Vérification d'identité requise.</span>{" "}
                <span className="text-muted-foreground">
                  La création de liens de paiement est débloquée une fois votre KYC validé
                  {kycStatus === "PENDING_REVIEW" ? " (votre dossier est en cours d'examen)" : ""}.
                </span>
              </span>
              <Link to="/kyc">
                <Button size="sm" variant="outline">
                  {kycStatus === "PENDING_REVIEW" ? "Suivre mon dossier" : "Faire mon KYC"}
                </Button>
              </Link>
            </div>
          </Card>
        )}

        <Card className="p-6 mb-8 bg-card border-border">
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-[1fr_120px_140px]">
              <div>
                <Label htmlFor="desc">Description *</Label>
                <Input
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Prestation, acompte..."
                  required
                />
              </div>
              <div>
                <Label htmlFor="cur">Devise facturée</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="cur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Montant *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100.00"
                  required
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-elevated/40 px-4 py-4 text-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="font-semibold text-foreground">Détail du transfert</span>
                {previewLoading && (
                  <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>

              {!breakdown ? (
                <p className="text-muted-foreground text-xs">
                  Saisissez un montant pour voir le détail (taux, frais, montant reçu).
                </p>
              ) : (
                <div className="space-y-2">
                  <Row
                    label="Votre client paie"
                    value={`${Number(amount).toFixed(2)} ${currency}`}
                    strong
                  />
                  {preview && currency !== payoutCurrency && (
                    <Row
                      label="Taux de change"
                      value={`1 ${currency} = ${preview.rate.toFixed(4)} ${payoutCurrency}`}
                      hint={`source ${preview.source}`}
                    />
                  )}
                  <Row
                    label="Frais de transaction"
                    value={`− ${breakdown.feeInvoice.toFixed(2)} ${currency}`}
                    hint={paymentFeeLabel(currency)}
                  />
                  <div className="my-2 border-t border-border/60" />
                  <Row
                    label="Vous recevez"
                    value={`${breakdown.netLocal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${payoutCurrency}`}
                    accent
                  />
                  {mmNumber ? (
                    <div className="mt-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
                      <div className="text-muted-foreground">Crédité sur votre Mobile Money</div>
                      <div className="mt-0.5 font-mono text-foreground">
                        {mmOperator ? `${mmOperator} · ` : ""}
                        {mmNumber}
                      </div>
                      {mmHolder && <div className="text-muted-foreground">{mmHolder}</div>}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-amber-300">
                      Aucun compte Mobile Money configuré.{" "}
                      <Link to="/billing" className="underline">
                        Configurer maintenant
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Client (optionnel)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Aucun —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contact_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={submitting || loading || kycStatus !== "APPROVED"}
              className="md:w-fit md:ml-auto"
            >
              <Plus className="w-4 h-4 mr-1" /> {submitting ? "..." : "Générer le lien"}
            </Button>
          </form>
        </Card>

        <Card className="bg-card border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Historique</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Aucun lien. Créez-en un ci-dessus.
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => (
                  <li key={r.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.description}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{new Date(r.created_at).toLocaleString("fr-FR")}</span>
                        {r.client_id && clientById[r.client_id] && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-elevated px-2 py-0.5">
                            <User className="h-3 w-3" /> {clientById[r.client_id].contact_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {Number(r.amount).toFixed(2)} {r.currency}
                      </div>
                      {r.local_amount != null &&
                        r.local_currency &&
                        r.local_currency !== r.currency && (
                          <div className="text-xs text-muted-foreground">
                            ≈{" "}
                            {Number(r.local_amount).toLocaleString("fr-FR", {
                              maximumFractionDigits: 2,
                            })}{" "}
                            {r.local_currency}
                          </div>
                        )}
                      <Badge variant="outline" className={statusVariant(r.status)}>
                        {r.status}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {r.status === "PAID" ? (
                        <span className="text-xs text-muted-foreground italic">Facture payée</span>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => copyLink(r.id)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <a href={`/pay/${r.id}`} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </a>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {rows.length > PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3 border-t border-border p-4 text-xs text-muted-foreground">
                  <span>
                    Page {page} sur {Math.ceil(rows.length / PAGE_SIZE)} · {rows.length} lien(s)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Précédent
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= Math.ceil(rows.length / PAGE_SIZE)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  strong,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right">
        <div
          className={
            accent
              ? "text-base font-bold text-primary"
              : strong
                ? "font-semibold text-foreground"
                : "text-foreground"
          }
        >
          {value}
        </div>
        {hint && (
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{hint}</div>
        )}
      </div>
    </div>
  );
}
