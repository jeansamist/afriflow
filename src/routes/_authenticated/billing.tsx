import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Save, Wallet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMyProfile, updatePayout } from "@/utils/settings.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Facturation Mobile Money · AfriFlow" }] }),
  component: BillingPage,
});

const OPERATORS = [
  { value: "ORANGE", label: "Orange Money" },
  { value: "MTN", label: "MTN MoMo" },
  { value: "WAVE", label: "Wave" },
  { value: "MOOV", label: "Moov Money" },
  { value: "AIRTEL", label: "Airtel Money" },
] as const;

// Map intl dial code → { country, currency }
const PHONE_PREFIX_MAP: Array<{ prefix: string; country: string; currency: string }> = [
  // UEMOA (XOF)
  { prefix: "221", country: "Sénégal", currency: "XOF" },
  { prefix: "225", country: "Côte d'Ivoire", currency: "XOF" },
  { prefix: "226", country: "Burkina Faso", currency: "XOF" },
  { prefix: "227", country: "Niger", currency: "XOF" },
  { prefix: "228", country: "Togo", currency: "XOF" },
  { prefix: "229", country: "Bénin", currency: "XOF" },
  { prefix: "223", country: "Mali", currency: "XOF" },
  { prefix: "245", country: "Guinée-Bissau", currency: "XOF" },
  // CEMAC (XAF)
  { prefix: "237", country: "Cameroun", currency: "XAF" },
  { prefix: "236", country: "Centrafrique", currency: "XAF" },
  { prefix: "235", country: "Tchad", currency: "XAF" },
  { prefix: "241", country: "Gabon", currency: "XAF" },
  { prefix: "242", country: "Congo", currency: "XAF" },
  { prefix: "240", country: "Guinée équatoriale", currency: "XAF" },
  // Autres
  { prefix: "234", country: "Nigeria", currency: "NGN" },
  { prefix: "254", country: "Kenya", currency: "KES" },
  { prefix: "233", country: "Ghana", currency: "GHS" },
  { prefix: "212", country: "Maroc", currency: "MAD" },
  { prefix: "250", country: "Rwanda", currency: "RWF" },
  { prefix: "20", country: "Égypte", currency: "EGP" },
  { prefix: "27", country: "Afrique du Sud", currency: "ZAR" },
  { prefix: "243", country: "RD Congo", currency: "CDF" },
  { prefix: "257", country: "Burundi", currency: "BIF" },
  { prefix: "256", country: "Ouganda", currency: "UGX" },
  { prefix: "255", country: "Tanzanie", currency: "TZS" },
  { prefix: "251", country: "Éthiopie", currency: "ETB" },
  { prefix: "260", country: "Zambie", currency: "ZMW" },
  { prefix: "258", country: "Mozambique", currency: "MZN" },
  { prefix: "261", country: "Madagascar", currency: "MGA" },
  { prefix: "216", country: "Tunisie", currency: "TND" },
  { prefix: "213", country: "Algérie", currency: "DZD" },
  { prefix: "218", country: "Libye", currency: "LYD" },
];

function detectFromPhone(raw: string): { country: string; currency: string } | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  // longest prefix match (up to 3 digits)
  const sorted = [...PHONE_PREFIX_MAP].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const p of sorted) {
    if (digits.startsWith(p.prefix)) return { country: p.country, currency: p.currency };
  }
  return null;
}

function BillingPage() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updatePayout);

  const { data: profile, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  const [operator, setOperator] = useState<string>("");
  const [number, setNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (profile && !initialized) {
    setOperator(profile.mobile_money_operator ?? "");
    setNumber(profile.mobile_money_number ?? "");
    setHolderName((profile as any).mobile_money_holder_name ?? "");
    setInitialized(true);
  }

  const detected = useMemo(() => detectFromPhone(number), [number]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: {
      mobile_money_operator: (operator || null) as "ORANGE"|"MTN"|"WAVE"|"MOOV"|"AIRTEL"|null,
      mobile_money_number: number || null,
      mobile_money_holder_name: holderName || null,
      payout_currency: (detected?.currency ?? null) as any,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-profile"] }); toast.success("Compte de réception mis à jour"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = operator && number.length >= 6 && holderName.trim().length >= 2 && detected;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-surface/40 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center px-4 sm:px-6 py-3 sm:py-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Tableau de bord
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary"><Wallet className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold">Facturation & paiements</h1>
            <p className="text-sm text-muted-foreground">Compte Mobile Money sur lequel vos encaissements internationaux sont reversés.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Les fonds encaissés en EUR/USD/CAD sont convertis et reversés sur ce compte Mobile Money sous 1 à 2 jours ouvrés.</span>
            </div>

            <div className="grid gap-4">
              <div>
                <Label>Opérateur Mobile Money</Label>
                <Select value={operator} onValueChange={setOperator}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un opérateur" /></SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Numéro Mobile Money</Label>
                <Input placeholder="+237 6XX XX XX XX" value={number} onChange={(e) => setNumber(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Format international, espaces autorisés.</p>
              </div>
              <div>
                <Label>Nom complet du titulaire</Label>
                <Input
                  placeholder="Nom enregistré chez l'opérateur"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">Doit correspondre exactement au nom du compte Mobile Money. Les transferts sont rejetés en cas de divergence.</p>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Devise de réception</div>
                {detected ? (
                  <div className="mt-1 flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">{detected.currency}</span>
                    <span className="text-muted-foreground">· {detected.country}</span>
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">Détectée automatiquement à partir de l'indicatif de votre numéro.</p>
                )}
              </div>

              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !canSave} className="md:w-fit">
                <Save className="h-4 w-4" /> {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
