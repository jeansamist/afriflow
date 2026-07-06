import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ShieldCheck, UploadCloud, Loader2, CheckCircle2, AlertCircle, Clock, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getKycStatus, submitKyc } from "@/utils/kyc.functions";
import { OPERATOR_LABELS, operatorsForCountry } from "@/lib/countries";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kyc")({
  head: () => ({ meta: [{ title: "Activer mon compte · AfriFlow" }] }),
  component: Kyc,
});

type DocKey = "id_front" | "id_back" | "selfie" | "client_invoice";
const DOCS: { key: DocKey; label: string; help: string; required: boolean }[] = [
  { key: "id_front", label: "Pièce d'identité (recto)", help: "CNI, passeport ou permis.", required: true },
  { key: "id_back", label: "Pièce d'identité (verso)", help: "Si applicable.", required: false },
  { key: "selfie", label: "Selfie avec votre pièce", help: "Visage et document bien visibles.", required: true },
  { key: "client_invoice", label: "Facture client (à l'étranger)", help: "PDF ou image d'une facture émise à un client basé hors de votre pays.", required: true },
];

function Kyc() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchStatus = useServerFn(getKycStatus);
  const submitFn = useServerFn(submitKyc);
  const { data: kyc, isLoading } = useQuery({ queryKey: ["kyc"], queryFn: () => fetchStatus() });

  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});
  const [uploaded, setUploaded] = useState<Partial<Record<DocKey, string>>>({});
  const [busy, setBusy] = useState<DocKey | "submit" | null>(null);
  const [momoOp, setMomoOp] = useState<string>("");
  const [momoNum, setMomoNum] = useState<string>("");
  const [momoHolder, setMomoHolder] = useState<string>("");

  const operators = operatorsForCountry(kyc?.country_iso);

  useEffect(() => {
    if (!kyc) return;
    const savedOp = kyc.mobile_money_operator ?? "";
    // Ne pré-remplit pas un opérateur qui n'est plus proposé pour le pays du compte.
    const allowed = operatorsForCountry(kyc.country_iso) as string[];
    setMomoOp(allowed.includes(savedOp) ? savedOp : "");
    setMomoNum(kyc.mobile_money_number ?? "");
    setMomoHolder(kyc.mobile_money_holder_name ?? "");
    setUploaded({
      id_front: kyc.kyc_doc_id_front ?? undefined,
      id_back: kyc.kyc_doc_id_back ?? undefined,
      selfie: kyc.kyc_doc_selfie ?? undefined,
      client_invoice: kyc.kyc_doc_address ?? undefined,
    });
  }, [kyc]);

  const status = kyc?.kyc_status ?? "NOT_SUBMITTED";
  const locked = status === "PENDING_REVIEW" || status === "APPROVED";

  const pick = async (key: DocKey, file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Fichier trop volumineux (max 10 Mo).");
    if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(file.type))
      return toast.error("Format accepté : JPG, PNG, WEBP ou PDF.");
    setFiles((f) => ({ ...f, [key]: file }));
    setBusy(key);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${user!.id}/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, {
      upsert: true, contentType: file.type,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    setUploaded((u) => ({ ...u, [key]: path }));
    toast.success("Document envoyé.");
  };

  const submitMut = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          idFront: uploaded.id_front!,
          idBack: uploaded.id_back ?? null,
          selfie: uploaded.selfie!,
          clientInvoice: uploaded.client_invoice!,
          mobileMoneyOperator: momoOp,
          mobileMoneyNumber: momoNum.trim(),
          mobileMoneyHolderName: momoHolder.trim(),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Dossier envoyé pour vérification.", {
        description: "Vous recevrez un e-mail dès la décision (sous 24 h).",
      });
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!uploaded.id_front || !uploaded.selfie) return toast.error("Pièce recto + selfie obligatoires.");
    if (!uploaded.client_invoice) return toast.error("Facture client à l'étranger obligatoire.");
    if (!momoOp) return toast.error("Choisissez votre opérateur Mobile Money.");
    if (!/^\+?\d[\d\s-]{6,18}$/.test(momoNum)) return toast.error("Numéro Mobile Money invalide.");
    if (!momoHolder.trim()) return toast.error("Indiquez le titulaire du compte.");
    submitMut.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
        </Link>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 shadow-elevated">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Vérification d'identité</h1>
              <p className="text-sm text-muted-foreground">
                Obligatoire pour les versements Mobile Money supérieurs à 200 € et pour activer définitivement votre numéro pro.
              </p>
            </div>
            <StatusBadge status={status} />
          </div>

          {status === "REJECTED" && kyc?.kyc_rejection_reason && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Dossier refusé</p>
                <p className="mt-1 text-muted-foreground">{kyc.kyc_rejection_reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">Corrigez les documents ci-dessous et renvoyez.</p>
              </div>
            </div>
          )}

          {status === "PENDING_REVIEW" && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>Dossier en cours de vérification. Décision sous 24 h.</span>
            </div>
          )}

          {status === "APPROVED" && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Compte vérifié — tous les plafonds sont débloqués.</span>
            </div>
          )}

          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">1 · Vos documents</h2>
            {DOCS.map((d) => {
              const done = uploaded[d.key];
              const loading = busy === d.key;
              return (
                <label
                  key={d.key}
                  aria-disabled={locked}
                  className={`flex items-center gap-4 rounded-xl border border-dashed border-border bg-surface-elevated p-4 transition-colors ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/50"}`}
                >
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-background">
                    {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> :
                      loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> :
                      <UploadCloud className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {d.label} {d.required && <span className="text-destructive">*</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {done ? "Document reçu · cliquez pour remplacer" : d.help}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {files[d.key]?.name?.slice(0, 18) ?? (done ? "Remplacer" : "Parcourir")}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={locked}
                    onChange={(e) => pick(d.key, e.target.files?.[0])}
                  />
                </label>
              );
            })}
          </div>

          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">2 · Compte Mobile Money de réception</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Opérateur</Label>
                <Select value={momoOp} onValueChange={setMomoOp} disabled={locked}>
                  <SelectTrigger><SelectValue placeholder="Choisir l'opérateur" /></SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Numéro Mobile Money</Label>
                <Input value={momoNum} onChange={(e) => setMomoNum(e.target.value)} placeholder="+221 77 000 00 00" disabled={locked} />
              </div>
              <div className="sm:col-span-2">
                <Label>Titulaire du compte</Label>
                <Input value={momoHolder} onChange={(e) => setMomoHolder(e.target.value)} placeholder="Nom complet" disabled={locked} />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Vos documents sont chiffrés. Seule notre équipe vérification y a accès.
            </p>
            {!locked ? (
              <Button onClick={submit} disabled={submitMut.isPending || isLoading} className="shadow-glow">
                {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  status === "REJECTED" ? "Renvoyer le dossier" : "Envoyer pour vérification"}
              </Button>
            ) : (
              <Link to="/dashboard"><Button variant="outline">Retour au dashboard</Button></Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "APPROVED")
    return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Vérifié</span>;
  if (status === "PENDING_REVIEW")
    return <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300"><Clock className="h-3 w-3" /> En revue</span>;
  if (status === "REJECTED")
    return <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs text-destructive"><XCircle className="h-3 w-3" /> Refusé</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/50 px-3 py-1 text-xs text-muted-foreground">Non démarré</span>;
}
