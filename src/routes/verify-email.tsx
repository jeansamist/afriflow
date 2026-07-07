import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendConfirmationEmail } from "@/utils/auth.functions";
import { toast } from "sonner";
import { useState } from "react";

const search = z.object({ email: z.string().email().optional() });

export const Route = createFileRoute("/verify-email")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Vérifiez votre email · AfriFlow" },
      {
        name: "description",
        content:
          "Un lien de confirmation vous a été envoyé. Vérifiez votre boîte mail pour activer votre compte.",
      },
    ],
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { email } = Route.useSearch();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!email) return;
    setSending(true);
    try {
      const res = await resendConfirmationEmail({ data: { email } });
      if (!res.ok) {
        toast.error(
          res.code === "cooldown"
            ? "Un email vient d'être envoyé. Patientez une minute avant de réessayer."
            : "L'email n'a pas pu être envoyé. Réessayez.",
        );
        return;
      }
      toast.success("Email renvoyé !");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Retour à la connexion
          </Link>
          <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-elevated">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
              <MailCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-xl font-semibold">Vérifiez votre boîte mail</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Nous venons d'envoyer un lien de confirmation à{" "}
              <span className="font-medium text-foreground">{email ?? "votre adresse"}</span>.
              Cliquez dessus pour activer votre cabine.
            </p>

            <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-4 text-left text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Vous ne voyez rien ?</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Vérifiez vos spams / courriers indésirables.</li>
                <li>Patientez quelques secondes, le mail peut tarder.</li>
                <li>L'adresse est-elle bien la bonne ?</li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={resend}
                disabled={!email || sending}
                variant="outline"
                className="w-full"
              >
                {sending ? "Envoi..." : "Renvoyer le lien"}
              </Button>
              <Link to="/auth" search={{ mode: "signin" }}>
                <Button variant="ghost" className="w-full">
                  J'ai déjà confirmé, me connecter
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
