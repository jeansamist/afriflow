import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Plus, Smartphone, ArrowLeft, CheckCircle2, ShieldCheck, KeyRound, Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { purchaseTopUp, TOPUP_PACKS } from "@/utils/wallet.functions";
import { getRate } from "@/utils/fx.functions";

type Operator = "ORANGE" | "MTN" | "WAVE" | "MOOV" | "AIRTEL" | null | undefined;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payoutCurrency?: string | null;
  mobileMoneyOperator?: Operator;
  mobileMoneyNumber?: string | null;
};

const OPERATORS: Record<NonNullable<Operator>, { label: string; ussd: string; chip: string }> = {
  ORANGE: { label: "Orange Money", ussd: "#144#",  chip: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  MTN:    { label: "MTN MoMo",     ussd: "*126#",  chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  WAVE:   { label: "Wave",         ussd: "Wave",   chip: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  MOOV:   { label: "Moov Money",   ussd: "*155#",  chip: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  AIRTEL: { label: "Airtel Money", ussd: "*128#",  chip: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const NO_DECIMAL = new Set(["XOF","XAF","RWF","UGX","TZS","CDF","BIF","MGA","KMF","DJF","GNF"]);

function formatLocal(amount: number, currency: string) {
  const decimals = NO_DECIMAL.has(currency) ? 0 : 0;
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
}

type Step = "select" | "phone" | "pin" | "processing" | "success";

export function TopUpDialog({
  open, onOpenChange, payoutCurrency, mobileMoneyOperator, mobileMoneyNumber,
}: Props) {
  const qc = useQueryClient();
  const buy = useServerFn(purchaseTopUp);
  const rateFn = useServerFn(getRate);

  const currency = (payoutCurrency || "EUR").toUpperCase();
  const operatorKey = (mobileMoneyOperator ?? null) as Operator;
  const operator = operatorKey ? OPERATORS[operatorKey] : null;

  const [selected, setSelected] = useState<number>(TOPUP_PACKS[1].minutes);
  const [custom, setCustom] = useState("");
  const [step, setStep] = useState<Step>("select");
  const [phone, setPhone] = useState<string>("");
  const [pin, setPin] = useState("");
  const [reference, setReference] = useState<string | null>(null);

  // Reset state when dialog re-opens
  useEffect(() => {
    if (open) {
      setStep("select");
      setPin("");
      setReference(null);
      setPhone(mobileMoneyNumber ?? "");
    }
  }, [open, mobileMoneyNumber]);

  // Packs are priced in FCFA (XOF); other currencies are converted automatically.
  const { data: fx } = useQuery({
    queryKey: ["fx-rate", "XOF", currency],
    queryFn: () => rateFn({ data: { base: "XOF", quote: currency } }),
    enabled: open && currency !== "XOF" && currency !== "XAF",
    staleTime: 60 * 60 * 1000,
  });
  const fxRate = currency === "XOF" || currency === "XAF" ? 1 : (fx?.rate ?? null);

  const chosenMin = custom ? Math.max(10, Number(custom) || 0) : selected;
  const chosenPack = TOPUP_PACKS.find((p) => p.minutes === chosenMin);
  const pricePerMin = chosenPack ? chosenPack.priceXof / chosenPack.minutes : 40; // 40 FCFA / min
  const chosenPriceXof = chosenPack ? chosenPack.priceXof : Math.round(chosenMin * pricePerMin);

  const localLabel = (xof: number) => {
    if (!fxRate) return "—";
    const v = xof * fxRate;
    return formatLocal(NO_DECIMAL.has(currency) ? Math.round(v) : Math.round(v * 100) / 100, currency);
  };

  const mut = useMutation({
    mutationFn: (minutes: number) => buy({ data: { minutes } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["phone-wallet"] });
      qc.invalidateQueries({ queryKey: ["minute-tx"] });
      setReference(r.reference);
      setStep("success");
      toast.success(`+${r.creditedMinutes} minutes créditées`, {
        description: `Réf. ${r.reference} — disponibles immédiatement.`,
      });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setStep("phone");
    },
  });

  const handleConfirmPin = async () => {
    if (pin.length < 4) {
      toast.error("Code PIN à 4 chiffres requis");
      return;
    }
    setStep("processing");
    // Simulate operator USSD round-trip
    await new Promise((r) => setTimeout(r, 1400));
    mut.mutate(chosenMin);
  };

  const handleClose = () => onOpenChange(false);

  const noMoMo = !operator || !mobileMoneyNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "select" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Recharger mes minutes
              </DialogTitle>
              <DialogDescription>
                Vos minutes supplémentaires <strong>n'expirent jamais</strong> et restent disponibles
                mois après mois.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-3">
              {TOPUP_PACKS.map((p) => {
                const active = !custom && selected === p.minutes;
                return (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => { setSelected(p.minutes); setCustom(""); }}
                    className={`rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-surface-elevated hover:border-primary/40"
                    }`}
                  >
                    <p className="text-2xl font-bold">
                      {p.minutes}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">min</span>
                    </p>
                    <p className="mt-1 text-sm font-semibold">{localLabel(p.priceXof)}</p>
                    <p className="text-[11px] text-muted-foreground">{p.priceXof.toLocaleString("fr-FR")} FCFA</p>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Ou montant personnalisé (minutes)</label>
              <Input
                type="number" min={10} max={5000} placeholder="ex. 75"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">À recharger</span>
                <span className="font-semibold">{chosenMin} min</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-semibold">
                  {localLabel(chosenPriceXof)}
                  <span className="ml-2 text-xs text-muted-foreground">{chosenPriceXof.toLocaleString("fr-FR")} FCFA</span>
                </span>
              </div>
              {operator ? (
                <p className={`mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${operator.chip}`}>
                  <Smartphone className="h-3 w-3" /> Débit {operator.label} · {mobileMoneyNumber}
                </p>
              ) : (
                <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] text-amber-300">
                  <Smartphone className="h-3 w-3" /> Aucun compte Mobile Money configuré
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Plus tard</Button>
              {noMoMo ? (
                <Link to="/billing">
                  <Button className="shadow-glow"><Settings className="h-4 w-4" /> Configurer Mobile Money</Button>
                </Link>
              ) : (
                <Button
                  onClick={() => setStep("phone")}
                  disabled={chosenMin < 10 || !fxRate}
                  className="shadow-glow"
                >
                  Acheter maintenant
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {step === "phone" && operator && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" /> Paiement {operator.label}
              </DialogTitle>
              <DialogDescription>
                Vous allez être débité de <strong>{localLabel(chosenPriceXof)}</strong> sur votre compte
                {" "}{operator.label}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Numéro Mobile Money</label>
                <Input
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  className="mt-1 font-mono"
                />
              </div>

              <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Minutes</span>
                  <span className="font-semibold">{chosenMin} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Montant à débiter</span>
                  <span className="font-bold text-lg">{localLabel(chosenPriceXof)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Frais opérateur</span>
                  <span>Inclus · 0 {currency}</span>
                </div>
              </div>

              <p className="text-[12px] text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-success shrink-0" />
                Un code <span className="font-mono">{operator.ussd}</span> vous sera envoyé pour
                confirmer le débit. Aucune donnée bancaire n'est partagée.
              </p>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("select")}>
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
              <Button
                onClick={() => setStep("pin")}
                disabled={!phone || phone.replace(/\D/g, "").length < 8}
                className="shadow-glow"
              >
                Envoyer la demande
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "pin" && operator && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Confirmez avec votre code PIN
              </DialogTitle>
              <DialogDescription>
                Demande envoyée au <span className="font-mono">{phone}</span>. Saisissez votre code
                {" "}{operator.label} pour autoriser le débit de <strong>{localLabel(chosenPriceXof)}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-black/40 p-5 font-mono text-sm space-y-2 text-foreground/90">
              <p className="text-xs text-muted-foreground">{operator.label} · {operator.ussd}</p>
              <p>Achat AfriFlow Minutes</p>
              <p>Montant : <span className="text-primary">{localLabel(chosenPriceXof)}</span></p>
              <p>Bénéficiaire : AFRIFLOW</p>
              <p className="pt-2 text-muted-foreground">Entrez votre code PIN pour valider :</p>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="mt-1 text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground pt-1">Astuce démo : tapez n'importe quel code à 4 chiffres.</p>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("phone")}>
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
              <Button onClick={handleConfirmPin} disabled={pin.length < 4} className="shadow-glow">
                Valider le paiement
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "processing" && (
          <div className="py-10 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <div>
              <p className="font-semibold">Traitement par {operator?.label}…</p>
              <p className="text-sm text-muted-foreground mt-1">Débit en cours sur {phone}</p>
            </div>
          </div>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" /> Paiement confirmé
              </DialogTitle>
              <DialogDescription>
                <strong>{chosenMin} minutes</strong> ont été créditées sur votre compte AfriFlow.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Montant débité</span><span className="font-semibold">{localLabel(chosenPriceXof)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Compte</span><span className="font-mono">{phone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Opérateur</span><span>{operator?.label}</span></div>
              {reference && <div className="flex justify-between"><span className="text-muted-foreground">Référence</span><span className="font-mono text-xs">{reference}</span></div>}
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="shadow-glow w-full">Terminé</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
