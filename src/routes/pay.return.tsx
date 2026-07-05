import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getStripeEnvironment } from "@/lib/stripe";
import { markPaymentLinkPaid } from "@/utils/payments.functions";

export const Route = createFileRoute("/pay/return")({
  validateSearch: (s: Record<string, unknown>): {
    linkId?: string;
    payment_intent?: string;
    redirect_status?: string;
  } => ({
    linkId: typeof s.linkId === "string" ? s.linkId : undefined,
    payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : undefined,
    redirect_status: typeof s.redirect_status === "string" ? s.redirect_status : undefined,
  }),
  component: ReturnPage,
});

function ReturnPage() {
  const { linkId, payment_intent, redirect_status } = Route.useSearch();
  const [state, setState] = useState<"loading" | "success" | "failed">(
    redirect_status === "succeeded" && linkId && payment_intent ? "loading" : "success",
  );

  useEffect(() => {
    if (redirect_status !== "succeeded" || !linkId || !payment_intent) return;

    markPaymentLinkPaid({
      data: {
        paymentLinkId: linkId,
        paymentIntentId: payment_intent,
        environment: getStripeEnvironment(),
      },
    })
      .then(() => setState("success"))
      .catch(() => setState("failed"));
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-10 max-w-md text-center bg-card border-border">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Confirmation du paiement…</p>
        </Card>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-10 max-w-md text-center bg-card border-border">
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-2xl font-bold">Paiement non confirmé</h1>
          <p className="mt-2 text-muted-foreground">
            Le paiement n'a pas pu être vérifié. Contactez le prestataire.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-10 max-w-md text-center bg-card border-border">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">Paiement enregistré</h1>
        <p className="mt-2 text-muted-foreground">
          Merci ! Votre paiement a été reçu et transmis au prestataire.
        </p>
        <Link to="/" className="mt-6 block">
          <Button variant="outline">Retour à l'accueil</Button>
        </Link>
      </Card>
    </div>
  );
}
