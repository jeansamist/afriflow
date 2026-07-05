import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Save, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyProfile, updateProfile } from "@/utils/settings.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Paramètres · AfriFlow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updateProfile);

  const { data: profile, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [init, setInit] = useState(false);
  if (profile && !init) {
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setCountry(profile.country_iso ?? "");
    setInit(true);
  }

  const saveMut = useMutation({
    mutationFn: () => save({ data: { first_name: firstName, last_name: lastName, country_iso: country || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Profil mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-surface/40 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center px-4 sm:px-6 py-3 sm:py-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Tableau de bord
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary"><Settings className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold">Paramètres du compte</h1>
            <p className="text-sm text-muted-foreground">Vos informations personnelles utilisées sur les reçus et factures.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prénom *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                <div><Label>Nom *</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled />
                <p className="mt-1 text-xs text-muted-foreground">L'email ne peut pas être modifié ici.</p>
              </div>
              <div>
                <Label>Pays (code ISO 2 lettres)</Label>
                <Input placeholder="CM, SN, CI, ML…" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                Numéro pro attribué : <span className="font-mono text-foreground">{profile?.allocated_phone_number ?? "—"}</span>
              </div>
              <Button onClick={() => saveMut.mutate()} disabled={!firstName || !lastName || saveMut.isPending} className="md:w-fit">
                <Save className="h-4 w-4" /> {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
            <div className="mt-6 border-t border-border pt-4 text-sm">
              <Link to="/billing" className="text-primary hover:underline">→ Gérer mon compte Mobile Money de réception</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
