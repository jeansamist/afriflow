import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

type State =
  | { kind: "loading" }
  | { kind: "valid"; email: string }
  | { kind: "invalid" }
  | { kind: "already" }
  | { kind: "submitting" }
  | { kind: "done"; email: string }
  | { kind: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (!r.ok || !j?.valid) {
          setState({ kind: j?.used ? "already" : "invalid" });
          return;
        }
        setState({ kind: "valid", email: j.email });
      } catch (e: any) {
        setState({ kind: "error", message: e?.message ?? "Erreur réseau" });
      }
    })();
  }, [token]);

  async function confirm() {
    if (!token || state.kind !== "valid") return;
    const email = state.email;
    setState({ kind: "submitting" });
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!r.ok) throw new Error("Échec de désinscription");
      setState({ kind: "done", email });
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "Erreur" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Désinscription</h1>
        <div className="mt-4 text-sm text-muted-foreground">
          {state.kind === "loading" && <p>Vérification du lien…</p>}
          {state.kind === "invalid" && <p>Ce lien est invalide ou a expiré.</p>}
          {state.kind === "already" && <p>Cette adresse est déjà désinscrite.</p>}
          {state.kind === "valid" && (
            <>
              <p>Souhaitez-vous désinscrire <strong>{state.email}</strong> ?</p>
              <button
                onClick={confirm}
                className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Confirmer la désinscription
              </button>
            </>
          )}
          {state.kind === "submitting" && <p>Désinscription en cours…</p>}
          {state.kind === "done" && (
            <p><strong>{state.email}</strong> ne recevra plus d'emails de notification.</p>
          )}
          {state.kind === "error" && <p className="text-destructive">{state.message}</p>}
        </div>
      </div>
    </div>
  );
}
