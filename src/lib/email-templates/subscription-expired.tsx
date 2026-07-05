import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, muted } from "./_shared";

interface Props {
  firstName?: string;
}

const Email = ({ firstName }: Props) => (
  <Layout preview="Votre abonnement Pro a expiré">
    <Heading style={h1}>Votre abonnement Pro a expiré</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Votre abonnement AfriFlow Pro est arrivé à échéance. Votre numéro est temporairement
      réservé. Renouvelez pour réactiver immédiatement vos appels sortants et vos paiements.
    </Text>
    <Text style={muted}>Réactivez en 1 clic via votre Mobile Money depuis le tableau de bord.</Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "🚫 Votre abonnement AfriFlow Pro a expiré",
  displayName: "Abonnement — expiré",
  previewData: { firstName: "Awa" },
} satisfies TemplateEntry;
