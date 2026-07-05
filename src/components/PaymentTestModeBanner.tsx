const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-center text-sm text-red-300">
        Production checkout is not configured. Complete Stripe go-live to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-orange-500/10 border-b border-orange-500/30 px-4 py-2 text-center text-sm text-orange-200">
        Mode test : tous les paiements sont fictifs. Carte test : <code>4242 4242 4242 4242</code>.
      </div>
    );
  }
  return null;
}
