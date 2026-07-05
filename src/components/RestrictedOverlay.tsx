import { ShieldAlert, Phone, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RestrictedBanner({
  onSubscribe,
  onTopUp,
}: {
  onSubscribe: () => void;
  onTopUp?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/15 text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Votre période découverte est terminée</p>
            <p className="text-xs text-muted-foreground">
              Votre numéro est <strong>réservé</strong>. Réactivez via Pro ou rechargez directement
              avec votre Mobile Money pour continuer à appeler.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onTopUp && (
            <Button variant="outline" onClick={onTopUp}>
              <Smartphone className="h-4 w-4" /> Recharger via Mobile Money
            </Button>
          )}
          <Button onClick={onSubscribe} className="shadow-glow">
            <Phone className="h-4 w-4" /> Activer Pro
          </Button>
        </div>
      </div>
    </div>
  );
}
