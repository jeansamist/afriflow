import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { grantPremiumIfWaitlisted } from "@/utils/waitlist.functions";
import { SUPPORTED_COUNTRIES, SUPPORTED_COUNTRY_ISOS } from "@/lib/countries";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).catch("signup"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Connexion · AfriFlow" },
      { name: "description", content: "Accédez à votre cabine AfriFlow ou créez un compte en moins d'une minute." },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(60),
  lastName: z.string().trim().min(1, "Nom requis").max(60),
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "8 caractères minimum").max(72),
  country: z.enum(SUPPORTED_COUNTRY_ISOS, { message: "Pays requis" }),
});
const signInSchema = z.object({
  email: z.string().trim().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const isSignUp = mode === "signup";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", country: "" });
  const [showPw, setShowPw] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const parsed = signUpSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              first_name: parsed.data.firstName,
              last_name: parsed.data.lastName,
              country_iso: parsed.data.country,
            },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        // Fire-and-forget: grant premium if the email is on the waitlist
        grantPremiumIfWaitlisted({ data: { email: parsed.data.email } }).catch(() => {});
        navigate({ to: "/verify-email", search: { email: parsed.data.email } });
      } else {
        const parsed = signInSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Bienvenue !");
        navigate({ to: "/dashboard" });
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
      toast.error("Connexion Google impossible. Réessayez.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  const sendReset = async () => {
    const email = forgotEmail.trim();
    if (!z.string().email().safeParse(email).success) return toast.error("Email invalide.");
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Email de réinitialisation envoyé.");
    setForgotOpen(false);
  };

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
          </Link>

          <div className="rounded-3xl border border-border bg-surface-elevated p-8 shadow-card">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary font-bold text-primary-foreground shadow-glow">A</span>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  {isSignUp ? "Créer votre compte" : "Content de vous revoir 👋"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {isSignUp ? "Gratuit · sans carte bancaire" : "Connectez-vous à votre espace."}
                </p>
              </div>
            </div>

            <Button onClick={onGoogle} disabled={loading} variant="outline" className="w-full">
              <GoogleIcon /> Continuer avec Google
            </Button>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="firstName" label="Prénom" icon={User} value={form.firstName}
                      onChange={(v) => setForm({ ...form, firstName: v })} placeholder="Aïcha" />
                    <Field id="lastName" label="Nom" value={form.lastName}
                      onChange={(v) => setForm({ ...form, lastName: v })} placeholder="Diallo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Pays de résidence</Label>
                    <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez votre pays" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_COUNTRIES.map((c) => (
                          <SelectItem key={c.iso} value={c.iso}>
                            <span className="mr-2 text-base leading-none">{c.flag}</span> {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <Field id="email" label="Email pro" type="email" icon={Mail} value={form.email}
                onChange={(v) => setForm({ ...form, email: v })} placeholder="vous@entreprise.com" />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Mot de passe</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => { setForgotEmail(form.email); setForgotOpen(true); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    placeholder="••••••••"
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="pl-9 pr-10"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignUp && <p className="text-[11px] text-muted-foreground">Au moins 8 caractères</p>}
              </div>

              <Button type="submit" className="w-full shadow-glow" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignUp ? "Créer mon compte" : "Se connecter"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignUp ? "Déjà un compte ? " : "Pas encore inscrit ? "}
              <Link
                to="/auth"
                search={{ mode: isSignUp ? "signin" : "signup" }}
                className="font-medium text-primary hover:underline"
              >
                {isSignUp ? "Se connecter" : "Créer un compte"}
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            En continuant, vous acceptez nos conditions et notre politique de confidentialité.
          </p>
        </div>
      </div>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Réinitialiser le mot de passe</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Recevez un lien sécurisé par email pour définir un nouveau mot de passe.
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="forgot-email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="vous@entreprise.com"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForgotOpen(false)}>Annuler</Button>
              <Button onClick={sendReset} disabled={forgotLoading}>
                {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le lien"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  id, label, value, onChange, type = "text", icon: Icon, placeholder, hint,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; icon?: React.ComponentType<{ className?: string }>;
  placeholder?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
        <Input
          id={id} type={type} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={Icon ? "pl-9" : ""}
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.3 12 2.3 6.7 2.3 2.5 6.5 2.5 11.8S6.7 21.3 12 21.3c6.9 0 9.3-4.8 9.3-7.3 0-.5 0-.9-.1-1.3H12z"/>
    </svg>
  );
}
