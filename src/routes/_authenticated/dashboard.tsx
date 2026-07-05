import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  LogOut, ShieldCheck, Phone, Users, Link2, ArrowUpRight, Clock,
  CheckCircle2, AlertCircle, PhoneOutgoing, PhoneIncoming, CreditCard,
  Sparkles, Settings, Wallet, Send, XCircle, Loader2, UserPlus,
} from "lucide-react";

import { getDashboardData } from "@/utils/dashboard.functions";
import { listPayouts, getWalletSummary, retryPayout } from "@/utils/payouts.functions";
import { getPhoneWallet } from "@/utils/wallet.functions";
import { PhoneFab } from "@/components/PhoneFab";
import { WalletMinutesCard } from "@/components/WalletMinutesCard";
import { TrialBanner } from "@/components/TrialBanner";
import { RestrictedBanner } from "@/components/RestrictedOverlay";
import { TopUpDialog } from "@/components/TopUpDialog";
import { ProSubscribeDialog } from "@/components/ProSubscribeDialog";
import { NotificationBell } from "@/components/NotificationBell";
import { isCurrentUserAdmin } from "@/utils/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord · AfriFlow" }] }),
  component: Dashboard,
});

const KYC_LABEL: Record<string, { label: string; color: string; pct: number }> = {
  NOT_SUBMITTED: { label: "À démarrer", color: "text-muted-foreground", pct: 10 },
  PENDING_REVIEW: { label: "En vérification", color: "text-sun", pct: 60 },
  APPROVED: { label: "Vérifié", color: "text-success", pct: 100 },
  REJECTED: { label: "À refaire", color: "text-destructive", pct: 30 },
};

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchData = useServerFn(getDashboardData);
  const fetchPayouts = useServerFn(listPayouts);
  const fetchWallet = useServerFn(getWalletSummary);
  const retryFn = useServerFn(retryPayout);
  const fetchPhoneWallet = useServerFn(getPhoneWallet);
  const adminCheckFn = useServerFn(isCurrentUserAdmin);
  const { data: isAdmin } = useQuery({ queryKey: ["is-admin"], queryFn: () => adminCheckFn() });

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchData() });
  const { data: payouts } = useQuery({ queryKey: ["payouts"], queryFn: () => fetchPayouts() });
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet() });
  const { data: phoneWallet } = useQuery({ queryKey: ["phone-wallet"], queryFn: () => fetchPhoneWallet() });

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [proSubscribeOpen, setProSubscribeOpen] = useState(false);
  const lastAlertRef = useRef<{ low?: boolean; critical?: boolean; empty?: boolean }>({});

  const retryMut = useMutation({
    mutationFn: (payoutId: string) => retryFn({ data: { payoutId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payouts"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      toast.success("Versement relancé.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 🔴 Realtime: refresh dashboard/payouts/wallet on payment + payout events.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`dashboard:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payouts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["payouts"] });
          qc.invalidateQueries({ queryKey: ["wallet"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          const row: any = payload.new;
          if (payload.eventType === "UPDATE" && row?.status === "SENT") {
            toast.success(
              `💸 Mobile Money crédité : ${Number(row.local_amount ?? row.net_amount).toLocaleString("fr-FR")} ${row.local_currency ?? row.gross_currency}`,
              { description: `Réf. ${row.provider_reference} — un e-mail vous a été envoyé.` },
            );
          } else if (payload.eventType === "INSERT" && row?.status === "PROCESSING") {
            toast.info("Transfert Mobile Money en cours…");
          } else if (row?.status === "FAILED") {
            toast.error("Échec du transfert Mobile Money.", { description: row.failure_reason ?? undefined });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payment_links", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "phone_wallets", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["phone-wallet"] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "minute_transactions", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["phone-wallet"] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const before: any = payload.old;
          const after: any = payload.new;
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["kyc"] });
          if (before?.kyc_status !== after?.kyc_status) {
            if (after?.kyc_status === "APPROVED")
              toast.success("✅ Votre compte est vérifié", { description: "Tous vos plafonds sont débloqués." });
            else if (after?.kyc_status === "REJECTED")
              toast.error("Dossier KYC refusé", { description: after?.kyc_rejection_reason ?? undefined });
            else if (after?.kyc_status === "PENDING_REVIEW")
              toast.info("Dossier KYC reçu — vérification en cours.");
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  // Minute thresholds → badge/toast/modal (fires once per threshold crossing)
  useEffect(() => {
    if (!phoneWallet) return;
    const m = phoneWallet.totalMinutesRemaining;
    const prev = lastAlertRef.current;
    if (m <= 0 && !prev.empty) {
      lastAlertRef.current = { ...prev, empty: true };
      toast.error("Vos crédits d'appel sont épuisés.", {
        description: "Rechargez maintenant pour continuer à appeler vos clients.",
        action: { label: "Recharger", onClick: () => setTopUpOpen(true) },
        duration: 10000,
      });
    } else if (m > 0 && m < 1 && !prev.critical) {
      lastAlertRef.current = { ...prev, critical: true };
      setTopUpOpen(true);
    } else if (m <= 5 && m > 1 && !prev.critical) {
      lastAlertRef.current = { ...prev, critical: true };
      toast.warning(`Plus que ${m} minute${m > 1 ? "s" : ""} disponibles.`, {
        action: { label: "Recharger", onClick: () => setTopUpOpen(true) },
      });
    } else if (m > 5) {
      // reset thresholds when user tops up
      if (prev.critical || prev.empty) lastAlertRef.current = {};
    }
  }, [phoneWallet?.totalMinutesRemaining]);


  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  };

  const kyc = data?.profile?.kyc_status ?? "NOT_SUBMITTED";
  const kycInfo = KYC_LABEL[kyc];
  const approved = kyc === "APPROVED";
  const allocation = data?.allocation;
  const counts = data?.counts ?? { clients: 0, paidCount: 0, paidTotal: 0, paidLocalTotal: 0, payoutCurrency: "XOF", pendingCount: 0 };
  const firstName = data?.profile?.first_name?.trim() || user?.email?.split("@")[0] || "";

  type NavTile = {
    to: "/phone" | "/crm" | "/payments" | "/settings" | "/billing";
    icon: typeof Phone; label: string; desc: string;
    count?: number | string; locked?: boolean; hint?: string;
  };
  const navItems: NavTile[] = [
    { to: "/phone", icon: Phone, label: "Appeler un client", desc: "Passez vos appels internationaux depuis votre navigateur.", locked: phoneWallet?.isRestricted || (!phoneWallet?.isTrial && !approved), hint: phoneWallet?.isRestricted ? "Réactiver" : (!phoneWallet?.isTrial && !approved) ? "Vérification requise" : !allocation ? "À activer" : undefined },
    { to: "/crm", icon: Users, label: "Vos clients", desc: "Vos appels, vos notes, vos paiements — par client.", count: counts.clients },
    { to: "/payments", icon: Link2, label: "Liens de paiement", desc: "Envoyez un lien, soyez payé par carte.", locked: !approved, hint: !approved ? "Vérification requise" : undefined, count: counts.pendingCount ? `${counts.pendingCount} en attente` : undefined },
    { to: "/settings", icon: Settings, label: "Mon profil", desc: "Vos informations personnelles.", },
    { to: "/billing", icon: Wallet, label: "Mobile Money", desc: "Votre compte de réception (Orange, MTN, Wave…)." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary font-bold text-primary-foreground shadow-glow">A</span>
            <span className="font-display text-lg font-bold tracking-tight">AfriFlow</span>
            <span
              title="Bêta privée — dépôts Mobile Money traités en moins de 10 min"
              className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
            >
              Bêta privée
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/admin/payouts">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </Link>
              </Button>
            )}
            <NotificationBell />
            <span className="hidden text-sm text-muted-foreground md:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {phoneWallet?.isTrial && (
          <div className="mb-4">
            <TrialBanner
              daysRemaining={phoneWallet.trialDaysRemaining ?? 0}
              minutesRemaining={phoneWallet.totalMinutesRemaining}
              onSubscribe={() => setProSubscribeOpen(true)}
            />
          </div>
        )}
        {phoneWallet?.isRestricted && (
          <div className="mb-4">
            <RestrictedBanner
              onSubscribe={() => setProSubscribeOpen(true)}
              onTopUp={() => setTopUpOpen(true)}
            />
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-border bg-surface-warm p-5 shadow-soft sm:p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium shadow-soft">
              {approved ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> <span className="text-success">Compte vérifié</span></>
              ) : kyc === "PENDING_REVIEW" ? (
                <><Clock className="h-3.5 w-3.5 text-sun" /> <span className="text-foreground/70">Vérification en cours</span></>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 text-primary" /> <span className="text-muted-foreground">Mode découverte</span></>
              )}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Bonjour {firstName} 👋
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              {approved
                ? "Tout est prêt. Appelez vos clients, envoyez vos liens — votre argent arrive sur votre Mobile Money."
                : "Vérifiez votre identité pour activer votre numéro pro et recevoir vos premiers paiements."}
            </p>

            <div className="mt-6 rounded-2xl border border-border bg-surface-elevated p-5 shadow-soft">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Vérification d'identité
                </span>
                <span className={kycInfo.color}>{kycInfo.label}</span>
              </div>
              <Progress value={kycInfo.pct} className="mt-3" />
              <div className="mt-4 flex flex-wrap gap-2">
                {kyc === "NOT_SUBMITTED" && (
                  <Link to="/kyc"><Button size="sm" className="shadow-glow"><ShieldCheck className="h-4 w-4" /> Démarrer la vérification</Button></Link>
                )}
                {kyc === "PENDING_REVIEW" && (
                  <span className="text-xs text-muted-foreground self-center">Réponse sous 24h</span>
                )}
                {kyc === "REJECTED" && (
                  <>
                    {(data?.profile as any)?.kyc_rejection_reason && (
                      <span className="text-xs text-destructive self-center">
                        Motif : {(data?.profile as any).kyc_rejection_reason}
                      </span>
                    )}
                    <Link to="/kyc"><Button size="sm" variant="outline">Refaire la vérification</Button></Link>
                  </>
                )}
                {approved && allocation && (
                  <span className="rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 font-mono text-sm font-semibold text-success">
                    {allocation.e164}
                  </span>
                )}
                {approved && !allocation && (
                  <Link to="/phone"><Button size="sm" className="shadow-glow"><Phone className="h-4 w-4" /> Activer mon numéro</Button></Link>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <KpiCard icon={Users} label="Clients" value={counts.clients} />
            <KpiCard
              icon={Wallet}
              label="Wallet (reçu Mobile Money)"
              value={Math.round(wallet?.totalLocal ?? 0).toLocaleString("fr-FR")}
              suffix={wallet?.localCurrency ?? counts.payoutCurrency ?? ""}
            />
            <WalletMinutesCard
              data={phoneWallet as any}
              onTopUp={() => setTopUpOpen(true)}
              onSubscribe={() => setProSubscribeOpen(true)}
            />
          </div>

        </section>

        {/* Versements automatiques Mobile Money */}
        <section className="mt-8 rounded-3xl border border-border bg-surface-elevated p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2"><Send className="h-4 w-4 text-success" /> Vos paiements reçus</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Dès qu'un client vous paie, on transfère l'argent sur votre Mobile Money.
              </p>
            </div>
            {wallet && (
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 font-medium text-success">{wallet.sentCount} reçus</span>
                {wallet.pendingCount > 0 && <span className="rounded-full border border-sun/40 bg-sun/15 px-2.5 py-1 font-medium text-foreground/70">{wallet.pendingCount} en cours</span>}
                {wallet.failedCount > 0 && <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-medium text-destructive">{wallet.failedCount} à relancer</span>}
              </div>
            )}
          </div>
          <div className="mt-5 divide-y divide-border/60">
            {(payouts ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun paiement pour l'instant. Envoyez un lien pour commencer.</p>
            ) : (
              payouts!.slice(0, 6).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      p.status === "SENT" ? "bg-success/12 text-success"
                      : p.status === "FAILED" ? "bg-destructive/10 text-destructive"
                      : "bg-sun/20 text-foreground/70"
                    }`}>
                      {p.status === "SENT" ? <CheckCircle2 className="h-4 w-4" />
                        : p.status === "FAILED" ? <XCircle className="h-4 w-4" />
                        : <Loader2 className="h-4 w-4 animate-spin" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {Number(p.local_amount ?? p.net_amount).toLocaleString("fr-FR")} {p.local_currency ?? p.gross_currency}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">net</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.mobile_money_operator ?? "—"} · {p.mobile_money_number ?? "à configurer"} · {new Date(p.created_at).toLocaleString("fr-FR")}
                      </p>
                      {p.failure_reason && <p className="text-xs text-destructive truncate">{p.failure_reason}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={
                      p.status === "SENT" ? "border-success/30 bg-success/10 text-success"
                      : p.status === "FAILED" ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-sun/40 bg-sun/15 text-foreground/70"
                    }>{p.status === "SENT" ? "Reçu" : p.status === "FAILED" ? "Échec" : "En cours"}</Badge>
                    {p.status === "FAILED" && p.payment_link_id && (
                      <Button size="sm" variant="outline" disabled={retryMut.isPending} onClick={() => retryMut.mutate(p.id)}>
                        Réessayer
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>


        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Accès rapide</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {navItems.map((n) => (
              <Link key={n.to} to={n.to} className="group">
                <div className={`relative h-full rounded-2xl border border-border bg-surface-elevated p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card ${n.locked ? "opacity-70" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/12 text-primary">
                      <n.icon className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                  </div>
                  <p className="mt-4 font-bold tracking-tight">{n.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.desc}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    {n.count !== undefined && <span className="text-muted-foreground">{n.count}</span>}
                    {n.locked && (
                      <Badge variant="outline" className="border-sun/40 bg-sun/15 text-foreground/70">
                        <AlertCircle className="mr-1 h-3 w-3" /> {n.hint}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-bold tracking-tight">Derniers appels</h3>
              <Link to="/phone" className="text-xs font-medium text-primary hover:underline">Voir tout →</Link>
            </div>
            <div className="mt-4 divide-y divide-border/60">
              {isLoading ? <Skel /> : (data?.recentCalls ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucun appel pour l'instant.</p>
              ) : (
                data!.recentCalls.map((c) => {
                  const outbound = c.direction === "OUTBOUND";
                  const other = outbound ? c.to_number : c.from_number;
                  const hasClient = !!(c as any).client_id;
                  return (
                    <div key={c.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                          {outbound ? <PhoneOutgoing className="h-4 w-4" /> : <PhoneIncoming className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-medium truncate">{other}</p>
                          <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("fr-FR")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{c.duration_seconds}s</span>
                        {!hasClient && other && (
                          <Link to="/crm" search={{ newContactPhone: other }} title="Ajouter ce contact">
                            <Button size="sm" variant="ghost"><UserPlus className="h-4 w-4" /></Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })

              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-bold tracking-tight">Derniers paiements</h3>
              <Link to="/payments" className="text-xs font-medium text-primary hover:underline">Voir tout →</Link>
            </div>
            <div className="mt-4 divide-y divide-border/60">
              {isLoading ? <Skel /> : (data?.recentPayments ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucun lien envoyé pour l'instant.</p>
              ) : (
                data!.recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.description}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("fr-FR")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{Number(p.amount).toFixed(2)} {p.currency}</p>
                      <Badge variant="outline" className={p.status === "PAID" ? "border-success/30 bg-success/10 text-success" : "border-sun/40 bg-sun/15 text-foreground/70"}>{p.status === "PAID" ? "Payé" : "En attente"}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      <PhoneFab disabled={phoneWallet?.isRestricted || (phoneWallet?.totalMinutesRemaining ?? 0) <= 0 || (!phoneWallet?.isTrial && (!approved || !allocation))} />
      <TopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        payoutCurrency={(data?.profile as any)?.payout_currency ?? (counts as any).payoutCurrency}
        mobileMoneyOperator={(data?.profile as any)?.mobile_money_operator ?? null}
        mobileMoneyNumber={(data?.profile as any)?.mobile_money_number ?? null}
      />
      <ProSubscribeDialog
        open={proSubscribeOpen}
        onOpenChange={setProSubscribeOpen}
        kycStatus={(data?.profile as any)?.kyc_status ?? "NOT_SUBMITTED"}
        mobileMoneyNumber={(data?.profile as any)?.mobile_money_number ?? null}
        mobileMoneyOperator={(data?.profile as any)?.mobile_money_operator ?? null}
        payoutCurrency={(data?.profile as any)?.payout_currency ?? (counts as any).payoutCurrency}
      />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, suffix }: { icon: typeof Users; label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}{suffix && <span className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</span>}</p>
    </div>
  );
}



function Skel() {
  return (
    <div className="space-y-3 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
      ))}
    </div>
  );
}
