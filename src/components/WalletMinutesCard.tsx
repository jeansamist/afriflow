import { Plus, Timer, Crown, Infinity as InfinityIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type WalletData = {
  wallet: any;
  includedMinutesRemaining: number;
  extraMinutesRemaining: number;
  totalMinutesRemaining: number;
  isTrial: boolean;
  isRestricted: boolean;
  isActive: boolean;
  needsPro?: boolean;
  trialDaysRemaining: number | null;
};

export function WalletMinutesCard({
  data,
  onTopUp,
  onSubscribe,
}: {
  data?: WalletData;
  onTopUp: () => void;
  onSubscribe: () => void;
}) {
  if (!data) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface-elevated/40" />;
  }
  const w = data.wallet;
  const includedCap = w.included_minutes;
  const includedRemain = data.includedMinutesRemaining;
  const usedPct = Math.min(
    100,
    Math.round(((includedCap - includedRemain) / Math.max(1, includedCap)) * 100),
  );
  const totalRemain = data.totalMinutesRemaining;
  const needsPro = data.needsPro ?? false;
  // Top-up requires all three: an active Pro plan, a running subscription
  // cycle (isActive covers both) and a balance under 20 minutes.
  const showTopUp = data.isActive && totalRemain < 20;
  const low = !needsPro && includedRemain <= 20;
  const critical = !needsPro && includedRemain <= 5;

  return (
    <div
      className={`rounded-2xl border p-5 ${critical ? "border-destructive/40 bg-destructive/5" : low ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-surface"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Timer className="h-3.5 w-3.5" /> Minutes d'appel
        </div>
        {data.isTrial && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            Essai · J{data.trialDaysRemaining ?? 0}/7
          </Badge>
        )}
        {data.isActive && (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
            <Crown className="mr-1 h-3 w-3" /> Plan {w.plan_name}
          </Badge>
        )}
        {data.isRestricted && !needsPro && (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            Compte restreint
          </Badge>
        )}
        {needsPro && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            <Crown className="mr-1 h-3 w-3" /> Plan Pro requis
          </Badge>
        )}
      </div>

      <p
        className={`mt-2 text-3xl font-bold ${critical ? "text-destructive" : low ? "text-amber-600" : ""}`}
      >
        {totalRemain}
        <span className="ml-1 text-sm font-normal text-muted-foreground">min restantes</span>
      </p>

      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Incluses (cycle)</span>
            <span>
              {includedRemain}/{includedCap} min
            </span>
          </div>
          <Progress value={usedPct} className="mt-1 h-1.5" />
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <InfinityIcon className="h-3 w-3" /> Supplémentaires (n'expirent jamais)
          </span>
          <span className="font-medium">{data.extraMinutesRemaining} min</span>
        </div>
      </div>

      {needsPro && (
        <p className="mt-3 text-xs text-muted-foreground">
          Vos {includedRemain} minutes offertes seront débloquées dès votre passage au plan Pro.
        </p>
      )}
      {low && (
        <p className={`mt-3 text-xs ${critical ? "text-destructive" : "text-amber-600"}`}>
          {critical
            ? `Il vous reste ${includedRemain} minutes incluses. Ajoutez du crédit pour éviter toute interruption.`
            : `Il vous reste ${includedRemain} minutes incluses. Évitez toute interruption de vos appels.`}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {showTopUp && (
          <Button size="sm" onClick={onTopUp} className="shadow-glow">
            <Plus className="h-4 w-4" /> Ajouter du crédit
          </Button>
        )}
        {(data.isTrial || data.isRestricted) && (
          <Button size="sm" variant="outline" onClick={onSubscribe}>
            <Crown className="h-4 w-4" /> Passer au plan Pro
          </Button>
        )}
      </div>
    </div>
  );
}
