import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TrialBanner({
  daysRemaining,
  minutesRemaining,
  onSubscribe,
}: {
  daysRemaining: number;
  minutesRemaining: number;
  onSubscribe: () => void;
}) {
  const day = 7 - Math.max(0, daysRemaining) + 1;
  return (
    <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 via-surface to-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              Essai découverte · Jour {Math.min(7, day)} / 7
            </p>
            <p className="text-xs text-muted-foreground">
              Numéro actif · {minutesRemaining} min restantes · {daysRemaining} jour{daysRemaining > 1 ? "s" : ""} restant{daysRemaining > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={onSubscribe} size="sm" className="shadow-glow">
          Passer au plan Pro
        </Button>
      </div>
    </div>
  );
}
