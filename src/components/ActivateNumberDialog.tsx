import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Check, Phone, Sparkles, ArrowRight, ArrowLeft, Gift } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { allocatePhoneNumber } from "@/utils/telephony.functions";

const COUNTRIES = [
  { iso: "FR", flag: "🇫🇷", name: "France", cc: "+33", sample: "1" },
  { iso: "BE", flag: "🇧🇪", name: "Belgique", cc: "+32", sample: "2" },
  { iso: "US", flag: "🇺🇸", name: "États-Unis", cc: "+1", sample: "415" },
  { iso: "CA", flag: "🇨🇦", name: "Canada", cc: "+1", sample: "514" },
] as const;

function randDigits(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function genSamples(country: (typeof COUNTRIES)[number]) {
  return Array.from({ length: 3 }, () => `${country.cc} ${country.sample} ${randDigits(2)} ${randDigits(2)} ${randDigits(2)} ${randDigits(2)}`);
}

export function ActivateNumberDialog({
  open,
  onOpenChange,
  isTrial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isTrial?: boolean;
}) {
  const qc = useQueryClient();
  const allocate = useServerFn(allocatePhoneNumber);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [country, setCountry] = useState<(typeof COUNTRIES)[number] | null>(null);
  const [samples, setSamples] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setCountry(null);
      setSamples([]);
      setPicked(null);
    }
  }, [open]);

  useEffect(() => {
    if (step === 2 && country) setSamples(genSamples(country));
  }, [step, country]);

  const mut = useMutation({
    mutationFn: () => allocate({ data: { country: country?.iso } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["phone-state"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["phone-wallet"] });
      toast.success(r.alreadyAllocated ? "Numéro déjà attribué." : `Numéro activé : ${r.allocation.e164}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const trialExpiry = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" /> Activer mon numéro
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Étape 1/3 · Choisissez le pays de votre numéro."}
            {step === 2 && "Étape 2/3 · Sélectionnez un numéro disponible."}
            {step === 3 && "Étape 3/3 · Confirmez l'activation."}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {COUNTRIES.map((c) => {
              const active = country?.iso === c.iso;
              return (
                <button
                  key={c.iso}
                  onClick={() => setCountry(c)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <span className="text-2xl" aria-hidden>{c.flag}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.cc}</p>
                  </div>
                  {active && <Check className="ml-auto h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && country && (
          <div className="space-y-2">
            {samples.map((s) => {
              const active = picked === s;
              return (
                <button
                  key={s}
                  onClick={() => setPicked(s)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <span className="font-mono text-base font-medium">{s}</span>
                  {active ? <Check className="h-4 w-4 text-primary" /> : <span className="text-xs text-muted-foreground">Choisir</span>}
                </button>
              );
            })}
            <button onClick={() => setSamples(genSamples(country))} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              Voir d'autres numéros
            </button>
          </div>
        )}

        {step === 3 && country && picked && (
          <div className="rounded-xl border border-border bg-surface-elevated p-5 text-center">
            <span className="text-3xl" aria-hidden>{country.flag}</span>
            <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Numéro à activer</p>
            <p className="mt-1 font-mono text-lg font-semibold">{picked}</p>
            {isTrial && (
              <Badge variant="outline" className="mt-3 gap-1 border-primary/40 text-primary">
                <Gift className="h-3 w-3" /> Essai offert · 10 min · expire le {trialExpiry}
              </Badge>
            )}
            <ul className="mt-4 space-y-1.5 text-left text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Check className="h-3 w-3 text-primary" /> Appels entrants & sortants illimités vers ce pays</li>
              <li className="flex items-center gap-2"><Check className="h-3 w-3 text-primary" /> Aucun engagement, résiliable à tout moment</li>
              <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-primary" /> Activation immédiate</li>
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {step > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} disabled={mut.isPending}>
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
          ) : <span />}
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={(step === 1 && !country) || (step === 2 && !picked)}
              className="shadow-glow"
            >
              Continuer <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="shadow-glow">
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Activer maintenant</>}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
