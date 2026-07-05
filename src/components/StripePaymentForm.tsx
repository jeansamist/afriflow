import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createPaymentIntent, markPaymentLinkPaid } from "@/utils/payments.functions";

// ── Inner form (must live inside <Elements>) ──────────────────────────────────

function PaymentForm({
  paymentLinkId,
  paymentIntentId,
  onSuccess,
}: {
  paymentLinkId: string;
  paymentIntentId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Fallback for redirect-based methods (3DS etc.) — linkId lets return page mark as paid
        return_url: `${window.location.origin}/pay/return?linkId=${paymentLinkId}`,
      },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Paiement échoué");
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      try {
        await markPaymentLinkPaid({
          data: {
            paymentLinkId,
            paymentIntentId: paymentIntent.id,
            environment: getStripeEnvironment(),
          },
        });
        onSuccess();
      } catch (err: unknown) {
        setError((err as Error).message ?? "Erreur lors de la confirmation");
        setLoading(false);
      }
    }
    // If paymentIntent is null here a redirect happened — handled by /pay/return
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={!stripe || !elements || loading}
        className="w-full shadow-glow"
        size="lg"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Payer maintenant"}
      </Button>
    </form>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  paymentLinkId: string;
}

export function StripePaymentForm({ paymentLinkId }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Prevent React StrictMode from creating two PaymentIntents (effect runs twice in dev)
  const creatingRef = useRef(false);

  useEffect(() => {
    if (creatingRef.current) return;
    creatingRef.current = true;

    createPaymentIntent({
      data: { paymentLinkId, environment: getStripeEnvironment() },
    })
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
        } else {
          setClientSecret(result.clientSecret);
          setPaymentIntentId(result.paymentIntentId);
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [paymentLinkId]);

  if (paid) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold">Paiement réussi !</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre paiement a été reçu. Merci !
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!clientSecret || !paymentIntentId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "night" } }}>
        <PaymentForm
          paymentLinkId={paymentLinkId}
          paymentIntentId={paymentIntentId}
          onSuccess={() => setPaid(true)}
        />
      </Elements>
    </div>
  );
}
