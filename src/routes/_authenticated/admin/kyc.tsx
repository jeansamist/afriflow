import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileImage,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminGetKycSignedUrls,
  adminListKycSubmissions,
  adminReviewKyc,
  isCurrentUserAdmin,
} from "@/utils/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/kyc")({
  ssr: false,
  component: AdminKycPage,
});

type StatusFilter = "ALL" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

const STATUS_CFG: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
  PENDING_REVIEW: {
    label: "En attente",
    tone: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    icon: <Clock className="h-3 w-3" />,
  },
  APPROVED: {
    label: "Approuvé",
    tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  REJECTED: {
    label: "Refusé",
    tone: "bg-red-500/15 text-red-700 border-red-500/30",
    icon: <XCircle className="h-3 w-3" />,
  },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, tone: "", icon: null };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${cfg.tone}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function AdminKycPage() {
  const qc = useQueryClient();
  const adminCheckFn = useServerFn(isCurrentUserAdmin);
  const listFn = useServerFn(adminListKycSubmissions);
  const reviewFn = useServerFn(adminReviewKyc);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING_REVIEW");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<any | null>(null);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => adminCheckFn() });
  const listQ = useQuery({
    queryKey: ["admin-kyc", statusFilter, search, page],
    queryFn: () => listFn({ data: { status: statusFilter, search, page } }),
    enabled: Boolean(adminQ.data),
  });

  const reviewMut = useMutation({
    mutationFn: (input: { userId: string; decision: "APPROVED" | "REJECTED"; reason?: string }) =>
      reviewFn({ data: input }),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === "APPROVED" ? "Dossier approuvé" : "Dossier refusé");
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      setReviewing(null);
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
            <span className="text-sm font-semibold">Admin · Vérification KYC</span>
            <Badge variant="outline" className="text-[10px]">
              <ShieldAlert className="h-3 w-3" /> Admin
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/payouts">Versements</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-kyc"] })}
            >
              <RefreshCcw className="h-3 w-3" /> Rafraîchir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Dossiers KYC
              {listQ.data && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({total} résultat{total > 1 ? "s" : ""})
                </span>
              )}
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-7 w-full sm:w-56"
                  placeholder="Nom, numéro Mobile Money…"
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setPage(1);
                  setStatusFilter(v as StatusFilter);
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING_REVIEW">En attente</SelectItem>
                  <SelectItem value="APPROVED">Approuvés</SelectItem>
                  <SelectItem value="REJECTED">Refusés</SelectItem>
                  <SelectItem value="ALL">Tous</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Mobile Money</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Soumis le</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQ.isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        <Loader2 className="inline h-4 w-4 animate-spin" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!listQ.isLoading && items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Aucun dossier.
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">{row.email ?? row.id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{row.mobile_money_number ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.mobile_money_operator ?? ""}{row.mobile_money_holder_name ? ` · ${row.mobile_money_holder_name}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileImage className="h-3 w-3" />
                          {[row.kyc_doc_id_front, row.kyc_doc_id_back, row.kyc_doc_selfie, row.kyc_doc_address]
                            .filter(Boolean).length}{" "}
                          doc{[row.kyc_doc_id_front, row.kyc_doc_id_back, row.kyc_doc_selfie, row.kyc_doc_address]
                            .filter(Boolean).length > 1 ? "s" : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.kyc_submitted_at
                          ? new Date(row.kyc_submitted_at).toLocaleDateString("fr-FR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={row.kyc_status} />
                        {row.kyc_status === "REJECTED" && row.kyc_rejection_reason && (
                          <p className="mt-1 text-[10px] text-muted-foreground max-w-[180px] truncate">
                            {row.kyc_rejection_reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setReviewing(row)}>
                          Examiner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {pages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page} / {pages} · {total} dossier{total > 1 ? "s" : ""}
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

      <KycReviewDialog
        submission={reviewing}
        onClose={() => setReviewing(null)}
        onDecision={(decision, reason) =>
          reviewMut.mutate({ userId: reviewing!.id, decision, reason })
        }
        loading={reviewMut.isPending}
      />
    </div>
  );
}

function KycReviewDialog({
  submission,
  onClose,
  onDecision,
  loading,
}: {
  submission: any | null;
  onClose: () => void;
  onDecision: (decision: "APPROVED" | "REJECTED", reason?: string) => void;
  loading: boolean;
}) {
  const getUrlsFn = useServerFn(adminGetKycSignedUrls);
  const [reason, setReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useMemo(() => {
    if (submission) {
      setReason("");
      setShowRejectForm(false);
    }
  }, [submission?.id]);

  const docPaths = submission
    ? [
        submission.kyc_doc_id_front,
        submission.kyc_doc_id_back,
        submission.kyc_doc_selfie,
        submission.kyc_doc_address,
      ].filter(Boolean)
    : [];

  const urlsQ = useQuery({
    queryKey: ["admin-kyc-urls", submission?.id],
    queryFn: () => getUrlsFn({ data: { paths: docPaths } }),
    enabled: Boolean(submission) && docPaths.length > 0,
    staleTime: 4 * 60 * 1000,
  });

  const DOC_LABELS: Record<string, string> = {
    [submission?.kyc_doc_id_front]: "Pièce d'identité (recto)",
    [submission?.kyc_doc_id_back]: "Pièce d'identité (verso)",
    [submission?.kyc_doc_selfie]: "Selfie",
    [submission?.kyc_doc_address]: "Facture client",
  };

  const alreadyDecided =
    submission?.kyc_status === "APPROVED" || submission?.kyc_status === "REJECTED";

  return (
    <Dialog open={Boolean(submission)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Examen du dossier KYC
          </DialogTitle>
        </DialogHeader>

        {submission && (
          <div className="space-y-5 text-sm">
            {/* User info */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Utilisateur</span>
                <span className="font-medium">
                  {[submission.first_name, submission.last_name].filter(Boolean).join(" ") || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">E-mail</span>
                <span>{submission.email ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mobile Money</span>
                <span>
                  {submission.mobile_money_operator} · {submission.mobile_money_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Titulaire</span>
                <span>{submission.mobile_money_holder_name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Soumis le</span>
                <span>
                  {submission.kyc_submitted_at
                    ? new Date(submission.kyc_submitted_at).toLocaleString("fr-FR")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Statut actuel</span>
                <StatusChip status={submission.kyc_status} />
              </div>
              {submission.kyc_status === "REJECTED" && submission.kyc_rejection_reason && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raison du refus</span>
                  <span className="text-destructive max-w-[280px] text-right">
                    {submission.kyc_rejection_reason}
                  </span>
                </div>
              )}
            </div>

            {/* Documents */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Documents soumis
              </h3>
              {urlsQ.isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Chargement des documents…
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docPaths.map((path: string) => {
                  const url = urlsQ.data?.[path];
                  const label = DOC_LABELS[path] ?? path.split("/").pop();
                  const isImage = /\.(jpe?g|png|webp)$/i.test(path);
                  return (
                    <div
                      key={path}
                      className="rounded-lg border border-border bg-muted/20 overflow-hidden"
                    >
                      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                        <span className="text-xs font-medium">{label}</span>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 hover:underline"
                          >
                            Ouvrir <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {url && isImage ? (
                        <img
                          src={url}
                          alt={label}
                          className="w-full h-40 object-cover"
                        />
                      ) : url ? (
                        <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <FileImage className="h-4 w-4" /> Voir le document
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
                          {urlsQ.isLoading ? "…" : "Indisponible"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rejection reason form */}
            {showRejectForm && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <p className="text-xs font-semibold text-destructive uppercase">Motif du refus</p>
                <Textarea
                  placeholder="Ex : Document illisible, photo floue, selfie non conforme…"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRejectForm(false)}
                    disabled={loading}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={loading || !reason.trim()}
                    onClick={() => onDecision("REJECTED", reason.trim())}
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                    Confirmer le refus
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {!alreadyDecided && !showRejectForm && (
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Fermer
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => setShowRejectForm(true)}
            >
              <XCircle className="h-3 w-3" /> Refuser
            </Button>
            <Button
              disabled={loading}
              onClick={() => onDecision("APPROVED")}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Approuver
            </Button>
          </DialogFooter>
        )}

        {alreadyDecided && (
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            {submission?.kyc_status === "APPROVED" && (
              <Button
                variant="destructive"
                disabled={loading}
                onClick={() => setShowRejectForm(true)}
              >
                <XCircle className="h-3 w-3" /> Révoquer l'approbation
              </Button>
            )}
            {submission?.kyc_status === "REJECTED" && (
              <Button
                disabled={loading}
                onClick={() => onDecision("APPROVED")}
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Approuver quand même
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
