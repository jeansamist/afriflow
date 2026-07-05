import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft, Phone, PhoneIncoming, PhoneOutgoing, PhoneOff, Mic, MicOff,
  Loader2, Delete, PhoneCall, ShieldAlert, UserPlus, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyPhoneState } from "@/utils/telephony.functions";
import { getDashboardData } from "@/utils/dashboard.functions";
import { getPhoneWallet, subscribePro } from "@/utils/wallet.functions";
import { useVoice } from "@/components/VoiceProvider";
import { TopUpDialog } from "@/components/TopUpDialog";

export const Route = createFileRoute("/_authenticated/phone")({
  head: () => ({ meta: [{ title: "Cabine téléphonique · AfriFlow" }] }),
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ dial: z.string().optional(), client: z.string().uuid().optional() }).parse(s),
  component: PhonePage,
});

const COUNTRIES: Record<string, { flag: string; name: string }> = {
  FR: { flag: "🇫🇷", name: "France" },
  BE: { flag: "🇧🇪", name: "Belgique" },
  US: { flag: "🇺🇸", name: "États-Unis" },
  CA: { flag: "🇨🇦", name: "Canada" },
  // Legacy simulated allocations
  CM: { flag: "🇨🇲", name: "Cameroun" },
  SN: { flag: "🇸🇳", name: "Sénégal" },
  BJ: { flag: "🇧🇯", name: "Bénin" },
  CI: { flag: "🇨🇮", name: "Côte d'Ivoire" },
  GA: { flag: "🇬🇦", name: "Gabon" },
  ML: { flag: "🇲🇱", name: "Mali" },
};

function PhonePage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const fetchState    = useServerFn(getMyPhoneState);
  const fetchDash     = useServerFn(getDashboardData);
  const fetchWallet   = useServerFn(getPhoneWallet);
  const subscribeFn   = useServerFn(subscribePro);

  const dashQ   = useQuery({ queryKey: ["dashboard"],    queryFn: () => fetchDash() });
  const stateQ  = useQuery({ queryKey: ["phone-state"],  queryFn: () => fetchState() });
  const walletQ = useQuery({ queryKey: ["phone-wallet"], queryFn: () => fetchWallet() });

  const kycApproved  = dashQ.data?.profile?.kyc_status === "APPROVED";
  const isTrial      = walletQ.data?.isTrial ?? false;
  const isRestricted = walletQ.data?.isRestricted ?? false;
  const minutesLeft  = walletQ.data?.totalMinutesRemaining ?? 0;
  const navigate = useNavigate();
  const [topUpOpen, setTopUpOpen] = useState(false);

  // ── App-wide Twilio Device (see VoiceProvider) ────────────────────────────
  const {
    deviceStatus, status, elapsed, muted, incomingFrom,
    connect, hangUp, acceptIncoming, declineIncoming, toggleMute,
  } = useVoice();

  const [dial, setDial] = useState("");

  const allocation = stateQ.data?.allocation;
  const logs       = stateQ.data?.logs ?? [];
  const [logFilter, setLogFilter] = useState<"all" | "in" | "out">("all");
  const filteredLogs = useMemo(
    () => logs.filter((l) =>
      logFilter === "all" ? true :
      logFilter === "in"  ? l.direction === "INBOUND" :
                            l.direction === "OUTBOUND",
    ),
    [logs, logFilter],
  );

  // Prefill from ?dial=
  useEffect(() => {
    if (search.dial && !dial) setDial(search.dial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.dial]);

  // ── Call controls (device + call lifecycle live in VoiceProvider) ─────────
  const startOutbound = async () => {
    if (!allocation) return toast.error("Aucun numéro actif.");
    if (dial.length < 4) return toast.error("Entrez un numéro complet.");
    if (isRestricted) return toast.error("Compte restreint. Réactivez votre plan.");
    if (minutesLeft <= 0) { setTopUpOpen(true); return; }
    if (deviceStatus !== "ready") return toast.error("Ligne non prête. Patientez…");

    try {
      await connect(dial, { clientId: search.client ?? null });
    } catch (err) {
      toast.error(`Échec de l'appel : ${(err as Error).message}`);
    }
  };

  const pressKey = (k: string) => {
    if (status !== "idle" && status !== "ended") return;
    if (k === "del") setDial((s) => s.slice(0, -1));
    else if (dial.length < 18) setDial((s) => s + k);
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const subscribeMut = useMutation({
    mutationFn: () => subscribeFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phone-wallet"] });
      toast.success("Plan Pro activé · vous pouvez appeler.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [logPage, setLogPage] = useState(1);
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice((logPage - 1) * PAGE_SIZE, logPage * PAGE_SIZE);
  useEffect(() => { setLogPage(1); }, [logFilter]);
  useEffect(() => { if (logPage > totalPages) setLogPage(totalPages); }, [logPage, totalPages]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "dialing":  return "Appel en cours…";
      case "ringing":  return "Sonnerie chez votre correspondant…";
      case "in-call":  return formatDuration(elapsed);
      case "ended":    return "Appel terminé";
      case "incoming": return `Appel entrant · ${incomingFrom}`;
      default:         return deviceStatus === "ready" ? "Prêt à appeler" : deviceStatus === "connecting" ? "Connexion…" : "Hors ligne";
    }
  }, [status, elapsed, incomingFrom, deviceStatus]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-elevated">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Votre cabine</p>
                  <p className="text-xs text-muted-foreground">VoIP · Twilio</p>
                </div>
              </div>
              {/* Device status indicator */}
              <Badge
                variant="outline"
                className={
                  deviceStatus === "ready"      ? "border-green-500/40 text-green-400" :
                  deviceStatus === "connecting"  ? "border-primary/40 text-primary" :
                  deviceStatus === "error"       ? "border-destructive/40 text-destructive" :
                                                   "border-border text-muted-foreground"
                }
              >
                {deviceStatus === "ready"      ? <><Wifi className="mr-1 h-3 w-3" />En ligne</> :
                 deviceStatus === "connecting"  ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Connexion…</> :
                 deviceStatus === "error"       ? <><WifiOff className="mr-1 h-3 w-3" />Erreur</> :
                                                  <><WifiOff className="mr-1 h-3 w-3" />Hors ligne</>}
              </Badge>
            </div>

            {isRestricted ? (
              <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center">
                <ShieldAlert className="mx-auto h-6 w-6 text-destructive" />
                <p className="mt-2 text-sm font-medium">Compte restreint</p>
                <p className="mt-1 text-xs text-muted-foreground">Votre essai est terminé. Réactivez votre numéro.</p>
                <Button className="mt-4 shadow-glow" onClick={() => subscribeMut.mutate()} disabled={subscribeMut.isPending}>
                  {subscribeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Réactiver mon numéro"}
                </Button>
              </div>
            ) : !isTrial && !kycApproved ? (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center">
                <ShieldAlert className="mx-auto h-6 w-6 text-amber-400" />
                <p className="mt-2 text-sm font-medium">Vérification d'identité requise</p>
                <p className="mt-1 text-xs text-muted-foreground">L'attribution d'un numéro est débloquée une fois votre KYC validé.</p>
                <Link to="/dashboard"><Button className="mt-4" variant="outline">Aller au KYC</Button></Link>
              </div>
            ) : !allocation ? (
              <div className="mt-6 rounded-xl border border-dashed border-border bg-surface-elevated p-5 text-center">
                <p className="text-sm font-medium">Aucun numéro attribué</p>
                <p className="mt-1 text-xs text-muted-foreground">Choisissez votre pays et activez votre numéro local en 3 étapes.</p>
                <ul className="mt-3 space-y-1 text-left text-xs text-muted-foreground inline-block">
                  <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Numéro local FR / BE / US / CA</li>
                  <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> 10 minutes d'essai offertes</li>
                  <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-primary" /> Activation immédiate</li>
                </ul>
                <div className="mt-4">
                  <Button className="shadow-glow" onClick={() => navigate({ to: "/onboarding/phone" })}>
                    Activer mon numéro
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Numéro actif</p>
                  <p className="font-mono text-lg font-semibold tracking-wide">{allocation.e164}</p>
                </div>
                <span className="text-2xl" aria-hidden>{COUNTRIES[allocation.country_iso]?.flag ?? "🌍"}</span>
              </div>
            )}

            {/* Display + status */}
            <div className="mt-5 rounded-xl bg-background/60 px-4 py-5 text-center">
              <input
                type="tel"
                value={dial}
                placeholder="—"
                disabled={status !== "idle" && status !== "ended"}
                onChange={(e) => {
                  // Allow only valid phone chars: digits, +, *, #, (, ), -, space
                  const clean = e.target.value.replace(/[^\d+*#()\- ]/g, "").slice(0, 18);
                  setDial(clean);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") startOutbound();
                  if (e.key === "Backspace" && dial === "") e.preventDefault();
                }}
                className="w-full bg-transparent text-center font-mono text-2xl font-semibold tracking-wider text-foreground outline-none placeholder:text-muted-foreground/40 disabled:opacity-60"
              />
              <p className={`mt-1 text-xs ${status === "in-call" ? "text-primary" : "text-muted-foreground"}`}>
                {statusLabel}
              </p>
            </div>

            {/* Keypad */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9","+","0","del"].map((k) => (
                <button
                  key={k}
                  onClick={() => pressKey(k)}
                  disabled={status !== "idle" && status !== "ended"}
                  className="h-12 rounded-lg border border-border bg-surface-elevated text-base font-medium transition hover:border-primary/50 hover:bg-surface disabled:opacity-40"
                >
                  {k === "del" ? <Delete className="mx-auto h-4 w-4" /> : k}
                </button>
              ))}
            </div>

            {/* Call controls */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {status === "incoming" ? (
                <>
                  <Button onClick={acceptIncoming} className="col-span-2 shadow-glow">
                    <PhoneCall className="h-4 w-4" /> Répondre
                  </Button>
                  <Button variant="destructive" onClick={declineIncoming}>
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </>
              ) : status === "idle" || status === "ended" ? (
                <>
                  <Button
                    onClick={startOutbound}
                    disabled={!allocation || dial.length < 4 || deviceStatus !== "ready"}
                    className="col-span-3 shadow-glow"
                  >
                    <PhoneOutgoing className="h-4 w-4" /> Appeler
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant={muted ? "secondary" : "outline"}
                    onClick={toggleMute}
                    disabled={status !== "in-call"}
                  >
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button variant="destructive" onClick={hangUp} className="col-span-2">
                    <PhoneOff className="h-4 w-4" /> Raccrocher
                  </Button>
                </>
              )}
            </div>

            {/* Pulsing dots while dialing/ringing */}
            {(status === "dialing" || status === "ringing") && (
              <div className="mt-4 flex items-center justify-center gap-1.5 text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6 shadow-elevated">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Journal d'appels</h2>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-elevated p-1 text-xs">
                {(["all","in","out"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setLogFilter(k)}
                    className={`rounded-md px-3 py-1.5 transition ${logFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {k === "all" ? `Tous (${logs.length})` : k === "in" ? `Entrants (${logs.filter((l)=>l.direction==="INBOUND").length})` : `Sortants (${logs.filter((l)=>l.direction==="OUTBOUND").length})`}
                  </button>
                ))}
              </div>
            </div>

            {stateQ.isLoading ? (
              <div className="mt-6 flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-border bg-surface-elevated p-10 text-center text-sm text-muted-foreground">
                Aucun appel pour l'instant. Composez un numéro pour démarrer.
              </div>
            ) : (
              <>
              <div className="mt-4 divide-y divide-border/60">
                {pagedLogs.map((l) => {
                  const outbound = l.direction === "OUTBOUND";
                  const other    = outbound ? l.to_number : l.from_number;
                  const ok       = l.status === "completed";
                  const hasClient = !!(l as any).client_id;
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ok ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                          {outbound ? <PhoneOutgoing className="h-4 w-4" /> : <PhoneIncoming className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-medium truncate">{other}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(l.created_at).toLocaleString("fr-FR")} ·{" "}
                            <span className={ok ? "text-primary" : "text-destructive"}>{statusFr(l.status)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-mono text-sm">{formatDuration(l.duration_seconds)}</p>
                          <p className="text-xs text-muted-foreground">{Number(l.cost_credits).toFixed(2)} crédits</p>
                        </div>
                        {!hasClient && other && (
                          <Link to="/crm" search={{ newContactPhone: other }} title="Créer un contact">
                            <Button size="sm" variant="outline" className="gap-1">
                              <UserPlus className="h-4 w-4" /> Ajouter
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Page {logPage} sur {totalPages} · {filteredLogs.length} appel(s)</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={logPage === 1} onClick={() => setLogPage((p) => Math.max(1, p - 1))}>Précédent</Button>
                    <Button size="sm" variant="outline" disabled={logPage >= totalPages} onClick={() => setLogPage((p) => Math.min(totalPages, p + 1))}>Suivant</Button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      </div>

      <TopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        payoutCurrency={(dashQ.data?.profile as any)?.payout_currency}
        mobileMoneyOperator={(dashQ.data?.profile as any)?.mobile_money_operator ?? null}
        mobileMoneyNumber={(dashQ.data?.profile as any)?.mobile_money_number ?? null}
      />
    </div>
  );
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function statusFr(s: string | null) {
  switch (s) {
    case "completed":  return "Terminé";
    case "no-answer":  return "Sans réponse";
    case "busy":       return "Occupé";
    case "failed":     return "Échec";
    default:           return s ?? "—";
  }
}
