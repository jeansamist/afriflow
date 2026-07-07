import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, muted } from "./_shared";

interface Props {
  firstName?: string;
  endsAt?: string;
}

const Email = ({ firstName, endsAt }: Props) => (
  <Layout preview="Votre abonnement Pro expire dans 2 jours">
    <Heading style={h1}>Renouvellement dans 2 jours ⏳</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Votre abonnement Pro AfriFlow arrive à échéance{endsAt ? ` le ${endsAt}` : ""}. Renouvelez dès
      maintenant pour conserver votre numéro pro et vos minutes incluses sans interruption.
    </Text>
    <Text style={muted}>Renouvellement en 1 clic depuis votre tableau de bord.</Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "⏳ Votre abonnement AfriFlow Pro expire dans 2 jours",
  displayName: "Abonnement — J-2",
  previewData: { firstName: "Awa", endsAt: "28 juin 2026" },
} satisfies TemplateEntry;
