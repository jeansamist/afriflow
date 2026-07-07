import { ShieldAlert, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RestrictedBanner({
  onSubscribe,
  needsPro = false,
}: {
  onSubscribe: () => void;
  /** Account never had a plan (not on the early-access waitlist): must subscribe first. */
  needsPro?: boolean;
}) {
  return (
    <div
      className={
        needsPro
          ? "rounded-2xl border border-primary/40 bg-primary/5 p-5"
          : "rounded-2xl border border-destructive/40 bg-destructive/5 p-5"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={
              needsPro
                ? "grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"
                : "grid h-10 w-10 place-items-center rounded-xl bg-destructive/15 text-destructive"
            }
          >
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            {needsPro ? (
              <>
                <p className="text-sm font-semibold">
                  Activez le plan Pro pour commencer à appeler
                </p>
                <p className="text-xs text-muted-foreground">
                  Vos minutes d'appel se débloquent avec le plan Pro — vos{" "}
                  <strong>10 minutes offertes</strong> y sont incluses.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Votre période découverte est terminée</p>
                <p className="text-xs text-muted-foreground">
                  Votre numéro est <strong>réservé</strong>. Réactivez le plan Pro pour continuer à
                  appeler vos clients.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSubscribe} className="shadow-glow">
            <Phone className="h-4 w-4" /> Activer Pro
          </Button>
        </div>
      </div>
    </div>
  );
}
