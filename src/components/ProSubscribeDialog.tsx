import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Crown,
  Loader2,
  CheckCircle2,
  Smartphone,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getProPlanOffer,
  initiateProSubscription,
  pollProPayment,
  finalizeProSubscription,
} from "@/utils/wallet.functions";

type Operator = "ORANGE" | "MTN" | "WAVE" | "MOOV" | "AIRTEL" | null | undefined;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kycStatus: string;
  mobileMoneyNumber?: string | null;
  mobileMoneyOperator?: Operator;
  payoutCurrency?: string | null;
};

const ELGIO_METHODS: { value: "mtn_mobile_money" | "orange_money"; label: string }[] = [
  { value: "mtn_mobile_money", label: "MTN Mobile Money" },
  { value: "orange_money", label: "Orange Money" },
];

const NO_DECIMAL = new Set(["XOF", "XAF", "RWF", "UGX", "TZS", "CDF", "BIF", "MGA"]);
const EUR_TO_CFA = 655; // same constant as elgiopay.server.ts (21 € = 13 755 FCFA)

function defaultMethod(op: Operator): "mtn_mobile_money" | "orange_money" {
  return op === "ORANGE" ? "orange_money" : "mtn_mobile_money";
}

function formatLocal(amount: number, currency: string): string {
  const v = NO_DECIMAL.has(currency) ? Math.round(amount) : Math.round(amount * 100) / 100;
  return `${v.toLocaleString("fr-FR")} ${currency}`;
}

function approxLocal(priceEur: number, currency: string): string {
  if (currency === "EUR") return `${priceEur.toFixed(2)} €`;
  return formatLocal(priceEur * EUR_TO_CFA, currency);
}

type Step = "offer" | "phone" | "processing" | "success";

export function ProSubscribeDialog({
  open,
  onOpenChange,
  kycStatus,
  mobileMoneyNumber,
  mobileMoneyOperator,
  payoutCurrency,
}: Props) {
  const qc = useQueryClient();
  const getOfferFn = useServerFn(getProPlanOffer);
  const initiateFn = useServerFn(initiateProSubscription);
  const pollFn = useServerFn(pollProPayment);
  const finalizeFn = useServerFn(finalizeProSubscription);

  const [step, setStep] = useState<Step>("offer");
  const [phone, setPhone] = useState(mobileMoneyNumber ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"mtn_mobile_money" | "orange_money">(
    defaultMethod(mobileMoneyOperator),
  );
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [numberPending, setNumberPending] = useState(false);

  const currency = (payoutCurrency || "XOF").toUpperCase();
  const kycApproved = kycStatus === "APPROVED";

  useEffect(() => {
    if (open) {
      setStep("offer");
      setPhone(mobileMoneyNumber ?? "");
      setPaymentMethod(defaultMethod(mobileMoneyOperator));
      setTransactionId(null);
      setNumberPending(false);
    }
  }, [open, mobileMoneyNumber, mobileMoneyOperator]);

  const { data: offer } = useQuery({
    queryKey: ["pro-plan-offer"],
    queryFn: () => getOfferFn(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const pollQ = useQuery({
    queryKey: ["pro-payment-status", transactionId],
    queryFn: () => pollFn({ data: { transactionId: transactionId! } }),
    enabled: !!transactionId && step === "processing",
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "completed" || s === "failed" ? false : 3000;
    },
  });

  const polledStatus = pollQ.data?.status ?? null;

  const initiateMut = useMutation({
    mutationFn: () => initiateFn({ data: { momoPhone: phone.trim(), paymentMethod } }),
    onSuccess: ({ transactionId: txId }) => {
      setTransactionId(txId);
      setStep("processing");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalizeMut = useMutation({
    mutationFn: () => finalizeFn({ data: { transactionId: transactionId! } }),
    onSuccess: (res) => {
      setNumberPending((res as { numberPending?: boolean })?.numberPending === true);
      qc.invalidateQueries({ queryKey: ["phone-wallet"] });
      qc.invalidateQueries({ queryKey: ["minute-tx"] });
      qc.invalidateQueries({ queryKey: ["phone-state"] });
      setStep("success");
    },
    onError: (e: Error) => {
      console.error("[pro-sub] finalize:", e.message);
      // Idempotency may have kicked in — still show success
      qc.invalidateQueries({ queryKey: ["phone-wallet"] });
      setStep("success");
    },
  });

  useEffect(() => {
    if (
      polledStatus === "completed" &&
      transactionId &&
      !finalizeMut.isPending &&
      !finalizeMut.isSuccess
    ) {
      finalizeMut.mutate();
    }
  }, [polledStatus]);

  const priceLabel = offer ? approxLocal(offer.priceEur, currency) : "…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* ── Step: offer ── */}
        {step === "offer" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" /> Plan Pro AfriFlow
              </DialogTitle>
              <DialogDescription>
                Appels reçus illimités, minutes d'appels sortants incluses et CRM complet.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Minutes incluses / mois</span>
                {offer ? (
                  <span className="text-2xl font-bold">
                    {offer.includedMinutes}
                    {!offer.isPremium && offer.trialMinutes > 0 && (
                      <span className="ml-2 text-xs font-normal text-primary">
                        dont {offer.trialMinutes} min d'essai offertes
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="h-8 w-14 animate-pulse rounded bg-muted/50" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Prix mensuel</span>
                <span className="font-semibold">{priceLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Durée du cycle</span>
                <span className="font-semibold">{offer?.cycleDays ?? 30} jours</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                Renouvellement manuel · les minutes incluses non utilisées n'expirent pas entre les
                cycles.
              </p>
            </div>

            {offer && !offer.hasPhoneNumber && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
                  <Phone className="h-4 w-4 shrink-0" /> Numéro professionnel requis
                </div>
                <p className="text-xs text-muted-foreground">
                  Choisissez d'abord un numéro professionnel (France, Belgique, Canada ou USA) — il
                  est inclus dans votre plan.
                </p>
                <Link to="/onboarding/phone">
                  <Button size="sm" variant="outline" className="w-full mt-1">
                    <Phone className="h-4 w-4" /> Choisir mon numéro
                  </Button>
                </Link>
              </div>
            )}

            {!kycApproved && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
                  <ShieldCheck className="h-4 w-4 shrink-0" /> Vérification KYC requise
                </div>
                <p className="text-xs text-muted-foreground">
                  Le plan Pro est réservé aux comptes dont l'identité a été vérifiée
                  {kycStatus === "PENDING_REVIEW" ? " (votre dossier est en cours d'examen)" : ""}.
                </p>
                <Link to="/kyc">
                  <Button size="sm" variant="outline" className="w-full mt-1">
                    <ShieldCheck className="h-4 w-4" />
                    {kycStatus === "PENDING_REVIEW"
                      ? "Suivre mon dossier"
                      : "Compléter la vérification"}
                  </Button>
                </Link>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Plus tard
              </Button>
              <Button
                onClick={() => setStep("phone")}
                disabled={!kycApproved || !offer || !offer.hasPhoneNumber}
                className="shadow-glow"
              >
                <Crown className="h-4 w-4" /> Souscrire maintenant
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: phone ── */}
        {step === "phone" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" /> Paiement Mobile Money
              </DialogTitle>
              <DialogDescription>
                Vous allez être débité de <strong>{priceLabel}</strong> pour activer le Plan Pro.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Numéro Mobile Money</label>
                <Input
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+237 6 00 00 00 00"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Opérateur</label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as "mtn_mobile_money" | "orange_money")}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ELGIO_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-semibold">
                    Pro · {offer?.includedMinutes ?? "…"} min / mois
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant à débiter</span>
                  <span className="font-bold text-lg">{priceLabel}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Compte débité</span>
                  <span className="font-mono">{phone || "—"}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("offer")}>
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
              <Button
                onClick={() => initiateMut.mutate()}
                disabled={
                  initiateMut.isPending || !phone.trim() || phone.replace(/\D/g, "").length < 8
                }
                className="shadow-glow"
              >
                {initiateMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmer le paiement"
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: processing ── */}
        {step === "processing" && (
          <div className="py-12 text-center space-y-4">
            {polledStatus === "failed" ? (
              <>
                <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
                <div>
                  <p className="font-semibold">Paiement refusé</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    L'opérateur n'a pas pu traiter votre demande.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTransactionId(null);
                    setStep("phone");
                  }}
                >
                  Réessayer
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <div>
                  <p className="font-semibold">Traitement du paiement…</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    En attente de confirmation Mobile Money.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step: success ── */}
        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" /> Plan Pro activé !
              </DialogTitle>
              <DialogDescription>
                {numberPending
                  ? "Votre abonnement est actif et vos minutes sont disponibles. L'activation de votre numéro réservé est en cours — elle sera finalisée très prochainement."
                  : "Votre abonnement est actif. Vos minutes sont disponibles immédiatement."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Minutes incluses</span>
                <span className="font-bold">{offer?.includedMinutes ?? "…"} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Durée du cycle</span>
                <span className="font-semibold">{offer?.cycleDays ?? 30} jours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant débité</span>
                <span className="font-semibold">{priceLabel}</span>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="shadow-glow w-full">
                Commencer à appeler
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
