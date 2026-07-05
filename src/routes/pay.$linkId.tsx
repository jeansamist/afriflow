import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { StripePaymentForm } from "@/components/StripePaymentForm";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { getPublicPaymentLink } from "@/utils/payments.functions";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/pay/$linkId")({
  component: PayPage,
});

function PayPage() {
  const { linkId } = Route.useParams();
  const fetchLink = useServerFn(getPublicPaymentLink);
  const [link, setLink] = useState<{
    id: string;
    amount: number;
    currency: string;
    description: string;
    status: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLink({ data: { paymentLinkId: linkId } })
      .then((r) => setLink(r as any))
      .catch((e) => setError(e.message || "Erreur"));
  }, [linkId]);

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="max-w-2xl mx-auto px-4 py-10">
        {error && (
          <Card className="p-8 text-center bg-card border-border">
            <h1 className="text-xl font-semibold mb-2">Lien introuvable</h1>
            <p className="text-muted-foreground">{error}</p>
          </Card>
        )}
        {!error && !link && (
          <Card className="p-8 text-center bg-card border-border">Chargement...</Card>
        )}
        {link && link.status === "PAID" && (
          <Card className="p-8 text-center bg-card border-border">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-2">Paiement déjà reçu</h1>
            <p className="text-muted-foreground">Ce lien a déjà été réglé. Merci !</p>
          </Card>
        )}
        {link && link.status !== "PAID" && (
          <>
            <Card className="p-6 mb-4 bg-card border-border">
              <p className="text-sm text-muted-foreground">Vous êtes sur le point de payer</p>
              <h1 className="text-2xl font-bold mt-1">{link.description}</h1>
              <p className="text-3xl font-display font-bold text-primary mt-2">
                {Number(link.amount).toFixed(2)} {link.currency}
              </p>
            </Card>
            <StripePaymentForm paymentLinkId={link.id} />
          </>
        )}
      </div>
    </div>
  );
}
