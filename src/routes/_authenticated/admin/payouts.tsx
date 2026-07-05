import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminListPayouts,
  adminPayoutStats,
  adminUpdatePayout,
  isCurrentUserAdmin,
} from "@/utils/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  ssr: false,
  component: AdminPayoutsPage,
});

type StatusFilter = "ALL" | "PENDING" | "PROCESSING" | "SENT" | "FAILED";

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "En attente", tone: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  PROCESSING: { label: "En cours", tone: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  SENT: { label: "Envoyé", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  FAILED: { label: "Échec", tone: "bg-red-500/15 text-red-700 border-red-500/30" },
};

function StatPill({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function AdminPayoutsPage() {
  const qc = useQueryClient();
  const adminCheckFn = useServerFn(isCurrentUserAdmin);
  const listFn = useServerFn(adminListPayouts);
  const statsFn = useServerFn(adminPayoutStats);
  const updateFn = useServerFn(adminUpdatePayout);

  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any | null>(null);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => adminCheckFn() });
  const statsQ = useQuery({
    queryKey: ["admin-payout-stats"],
    queryFn: () => statsFn(),
    enabled: Boolean(adminQ.data),
  });
  const listQ = useQuery({
    queryKey: ["admin-payouts", status, search, page],
    queryFn: () => listFn({ data: { status, search, page } }),
    enabled: Boolean(adminQ.data),
  });

  const updateMut = useMutation({
    mutationFn: (input: any) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success("Versement mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      qc.invalidateQueries({ queryKey: ["admin-payout-stats"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  if (adminQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!adminQ.data) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-destructive" /> Accès refusé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Cette page est réservée aux administrateurs AfriFlow.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="h-3 w-3" /> Retour au dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = statsQ.data;
  const items = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="inline h-3 w-3" /> Dashboard
            </Link>
            <span className="text-sm font-semibold">Admin · Versements</span>
            <Badge variant="outline" className="text-[10px]">
              <ShieldAlert className="h-3 w-3" /> Admin
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/kyc">KYC</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["admin-payouts"] });
                qc.invalidateQueries({ queryKey: ["admin-payout-stats"] });
              }}
            >
              <RefreshCcw className="h-3 w-3" /> Rafraîchir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatPill
            label="Transactions du jour"
            value={String(stats?.transactionsToday ?? "—")}
            hint="Liens créés (UTC)"
          />
          <StatPill
            label="Collecté (EUR)"
            value={`${(stats?.collectedToday ?? 0).toLocaleString("fr-FR")} €`}
          />
          <StatPill
            label="Reversé (EUR)"
            value={`${(stats?.reversedToday ?? 0).toLocaleString("fr-FR")} €`}
          />
          <StatPill
            label="Commissions"
            value={`${(stats?.feesToday ?? 0).toLocaleString("fr-FR")} €`}
            hint={`${stats?.pendingCount ?? 0} en attente · ${stats?.failedCount ?? 0} échec`}
          />
        </section>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4" /> Tous les versements
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-7 w-full sm:w-56"
                  placeholder="Numéro, nom, référence…"
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                />
              </div>
              <Select
                value={status}
                onValueChange={(v) => {
                  setPage(1);
                  setStatus(v as StatusFilter);
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous statuts</SelectItem>
                  <SelectItem value="PENDING">En attente</SelectItem>
                  <SelectItem value="PROCESSING">En cours</SelectItem>
                  <SelectItem value="SENT">Envoyé</SelectItem>
                  <SelectItem value="FAILED">Échec</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Freelance</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Mobile Money</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQ.isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        <Loader2 className="inline h-4 w-4 animate-spin" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!listQ.isLoading && items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucun versement.
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((p: any) => {
                    const cfg = STATUS_LABEL[p.status] ?? { label: p.status, tone: "" };
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">
                            {p.freelance.first_name || p.freelance.last_name
                              ? `${p.freelance.first_name ?? ""} ${p.freelance.last_name ?? ""}`.trim()
                              : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.freelance.email ?? p.user_id.slice(0, 8)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>
                            {Number(p.local_amount ?? 0).toLocaleString("fr-FR")}{" "}
                            {p.local_currency}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ≈ {Number(p.net_amount ?? 0).toLocaleString("fr-FR")}{" "}
                            {p.gross_currency}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{p.mobile_money_number ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.mobile_money_operator ?? ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${cfg.tone}`}
                          >
                            {cfg.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                            Gérer
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Page {page} / {pages} · {total} versements
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Précédent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <EditPayoutDialog
        payout={editing}
        onClose={() => setEditing(null)}
        onSubmit={(input) => updateMut.mutate({ payoutId: editing.id, ...input })}
        loading={updateMut.isPending}
      />
    </div>
  );
}

function EditPayoutDialog({
  payout,
  onClose,
  onSubmit,
  loading,
}: {
  payout: any | null;
  onClose: () => void;
  onSubmit: (input: any) => void;
  loading: boolean;
}) {
  const [providerReference, setProviderReference] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [adminNote, setAdminNote] = useState("");

  // sync state when opening
  useMemo(() => {
    if (payout) {
      setProviderReference(payout.provider_reference ?? "");
      setFailureReason(payout.failure_reason ?? "");
      setAdminNote(payout.admin_note ?? "");
    }
  }, [payout?.id]);

  return (
    <Dialog open={Boolean(payout)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gérer le versement</DialogTitle>
        </DialogHeader>
        {payout && (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bénéficiaire</span>
                <span className="font-medium">
                  {payout.freelance.first_name ?? ""} {payout.freelance.last_name ?? ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mobile Money</span>
                <span>{payout.mobile_money_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-semibold">
                  {Number(payout.local_amount ?? 0).toLocaleString("fr-FR")} {payout.local_currency}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Référence opérateur
              </label>
              <Input
                value={providerReference}
                onChange={(e) => setProviderReference(e.target.value)}
                placeholder="ex. MP240624.1234.A12345"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Raison d'échec (si applicable)
              </label>
              <Input
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="Compte introuvable, plafond atteint…"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Note interne (admin)
              </label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
        )}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() =>
              onSubmit({ providerReference, failureReason, adminNote })
            }
          >
            Enregistrer la note
          </Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={() =>
              onSubmit({
                status: "FAILED",
                providerReference,
                failureReason,
                adminNote,
              })
            }
          >
            <XCircle className="h-3 w-3" /> Marquer échec
          </Button>
          <Button
            disabled={loading}
            onClick={() =>
              onSubmit({
                status: "SENT",
                providerReference,
                failureReason,
                adminNote,
              })
            }
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Marquer envoyé
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
