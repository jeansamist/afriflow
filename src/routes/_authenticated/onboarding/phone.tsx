import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Phone,
  Loader2,
  CheckCircle2,
  ArrowRight,
  SkipForward,
  Mic,
  MessageSquare,
  ArrowLeft,
  X,
  PhoneCall,
  PhoneIncoming,
  Shield,
  Zap,
  Globe,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PHONE_COUNTRIES,
  searchPhoneNumbers,
  freeAllocatePhoneNumber,
  dismissPhoneOnboarding,
} from "@/utils/phone-subscription.functions";

export const Route = createFileRoute("/_authenticated/onboarding/phone")({
  head: () => ({ meta: [{ title: "Votre numéro · AfriFlow" }] }),
  component: OnboardingPhone,
});

const COUNTRY_LIST = Object.entries(PHONE_COUNTRIES).map(([iso, c]) => ({ iso, ...c }));

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  region: string | null;
  locality: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  monthlyPriceUsd: number;
}

function OnboardingPhone() {
  const navigate = useNavigate();

  const searchFn = useServerFn(searchPhoneNumbers);
  const allocateFn = useServerFn(freeAllocatePhoneNumber);
  const dismissFn = useServerFn(dismissPhoneOnboarding);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countryIso, setCountryIso] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [selected, setSelected] = useState<AvailableNumber | null>(null);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);
  const [isReserved, setIsReserved] = useState(false);

  const searchMut = useMutation({
    mutationFn: (iso: string) => searchFn({ data: { countryIso: iso } }),
    onSuccess: (data) => {
      setNumbers(data.slice(0, 5));
      setStep(2);
      if (data.length === 0) toast.info("Aucun numéro disponible dans ce pays pour le moment.");
    },
    onError: (e: Error) => {
      toast.error(e.message, { duration: 8000 });
    },
  });

  const allocateMut = useMutation({
    mutationFn: () => {
      if (!selected || !countryIso) throw new Error("Sélectionnez un numéro");
      return allocateFn({ data: { phoneNumber: selected.phoneNumber, countryIso } });
    },
    onSuccess: (res) => {
      setProvisionedNumber(res.phoneNumber);
      setIsReserved(res.reserved === true);
      setStep(3);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismissMut = useMutation({
    mutationFn: () => dismissFn(),
    onSuccess: () => navigate({ to: "/dashboard" }),
    onError: () => navigate({ to: "/dashboard" }),
  });

  function selectCountry(iso: string) {
    if (iso !== countryIso) {
      setNumbers([]);
      setSelected(null);
    }
    setCountryIso(iso);
  }

  function handleContinue() {
    if (!countryIso) return;
    if (numbers.length > 0) setStep(2);
    else searchMut.mutate(countryIso);
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary font-bold text-primary-foreground shadow-glow">
              A
            </span>
            <div>
              <p className="text-xs text-muted-foreground">AfriFlow · Configuration</p>
              <h1 className="text-lg font-bold">Votre numéro professionnel</h1>
            </div>
          </div>
          {step < 3 && (
            <button
              onClick={() => dismissMut.mutate()}
              disabled={dismissMut.isPending}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" /> Passer
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-2">
          <StepDot active={step === 1} done={step > 1} label="1" />
          <div
            className={`h-px flex-1 transition-colors ${step > 1 ? "bg-primary" : "bg-border"}`}
          />
          <StepDot active={step === 2} done={step > 2} label="2" />
          <div
            className={`h-px flex-1 transition-colors ${step > 2 ? "bg-primary" : "bg-border"}`}
          />
          <StepDot active={step === 3} done={false} label="3" />
        </div>

        {/* ── STEP 1: Country ── */}
        {step === 1 && (
          <>
            <p className="mb-1 text-sm font-medium text-muted-foreground">
              Étape 1 · Choisissez un pays
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Mêmes minutes incluses et même prix quel que soit le pays choisi.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COUNTRY_LIST.map((c) => (
                <button
                  key={c.iso}
                  onClick={() => selectCountry(c.iso)}
                  disabled={searchMut.isPending}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition
                    hover:border-primary/50 hover:bg-surface-elevated disabled:opacity-60
                    ${
                      countryIso === c.iso
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-surface"
                    }`}
                >
                  <span className="text-3xl leading-none">{c.flag}</span>
                  <span className="text-sm font-medium leading-tight">{c.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <Button
                onClick={handleContinue}
                disabled={!countryIso || searchMut.isPending}
                size="lg"
                className="w-full shadow-glow"
              >
                {searchMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continuer <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <button
                onClick={() => dismissMut.mutate()}
                disabled={dismissMut.isPending}
                className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipForward className="h-4 w-4" />
                Passer pour l'instant · aller au tableau de bord
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Number selection ── */}
        {step === 2 && countryIso && (
          <>
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              Étape 2 · Choisissez un numéro{" "}
              <span className="text-foreground">
                {PHONE_COUNTRIES[countryIso]?.flag} {PHONE_COUNTRIES[countryIso]?.name}
              </span>
            </p>

            {numbers.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted-foreground">
                Aucun numéro disponible dans ce pays. Essayez un autre.
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4" /> Retour
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-surface shadow-elevated overflow-hidden">
                  <div className="divide-y divide-border/60">
                    {numbers.map((n) => {
                      const isSel = selected?.phoneNumber === n.phoneNumber;
                      return (
                        <button
                          key={n.phoneNumber}
                          onClick={() => setSelected(isSel ? null : n)}
                          className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-surface-elevated ${isSel ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isSel ? "bg-primary/20 text-primary" : "bg-surface-elevated text-muted-foreground"}`}
                            >
                              {isSel ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Phone className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-mono font-semibold text-sm">{n.friendlyName}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {[n.locality, n.region].filter(Boolean).join(", ") || "—"}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {n.capabilities.voice && (
                              <Badge
                                variant="outline"
                                className="border-primary/30 text-primary text-[10px] px-1.5 py-0"
                              >
                                <Mic className="h-2.5 w-2.5 mr-0.5" /> Voix
                              </Badge>
                            )}
                            {n.capabilities.sms && (
                              <Badge
                                variant="outline"
                                className="border-primary/30 text-primary text-[10px] px-1.5 py-0"
                              >
                                <MessageSquare className="h-2.5 w-2.5 mr-0.5" /> SMS
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Retour
                  </Button>
                  <Button
                    onClick={() => allocateMut.mutate()}
                    disabled={!selected || allocateMut.isPending}
                    size="lg"
                    className="shadow-glow"
                  >
                    {allocateMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Activer ce numéro <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 3 && (
          <>
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              {isReserved
                ? "Étape 3 · Votre numéro est réservé"
                : "Étape 3 · Votre numéro est prêt"}
            </p>

            <div className="rounded-2xl border border-border bg-surface p-6 shadow-elevated text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-xl font-bold">
                {isReserved ? "Numéro réservé !" : "Numéro activé !"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {isReserved
                  ? "Ce numéro vous est réservé · il sera activé dès votre passage au plan Pro."
                  : "Numéro provisoire actif · souscrivez au plan Pro pour l'activer définitivement."}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <span className="font-mono text-lg font-bold tracking-wider text-foreground">
                  {provisionedNumber}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
              <Crown className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                {isReserved
                  ? "Votre numéro est réservé mais pas encore actif. Souscrivez au plan Pro depuis votre tableau de bord pour l'activer et débloquer vos minutes d'appel."
                  : "Votre numéro est provisoire. Souscrivez au plan Pro depuis votre tableau de bord pour activer vos minutes d'appel et maintenir votre numéro actif."}
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              <ExplCard
                icon={<PhoneCall className="h-4 w-4" />}
                title="Passez des appels VoIP"
                body="Appelez n'importe quel numéro depuis votre cabine AfriFlow avec vos minutes incluses."
              />
              <ExplCard
                icon={<PhoneIncoming className="h-4 w-4" />}
                title="Recevez des appels entrants"
                body="Partagez ce numéro à vos clients. Les appels arrivent directement dans votre cabine."
              />
              <ExplCard
                icon={<Shield className="h-4 w-4" />}
                title="Numéro professionnel séparé"
                body="Gardez votre numéro personnel privé. Ce numéro est lié à votre compte AfriFlow."
              />
              <ExplCard
                icon={<Zap className="h-4 w-4" />}
                title="Intégré à votre CRM"
                body="Chaque appel est enregistré et associé à vos dossiers clients automatiquement."
              />
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Button
                className="w-full shadow-glow"
                size="lg"
                onClick={() => navigate({ to: "/dashboard" })}
              >
                <Globe className="h-4 w-4" />
                Aller au tableau de bord · souscrire au Pro
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${done ? "bg-primary text-primary-foreground" : active ? "border-2 border-primary text-primary" : "border-2 border-border text-muted-foreground"}`}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : label}
    </div>
  );
}

function ExplCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-border bg-surface px-4 py-3.5">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
