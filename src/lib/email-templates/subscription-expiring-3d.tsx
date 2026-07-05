import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, muted } from "./_shared";

interface Props {
  firstName?: string;
  endsAt?: string;
}

const Email = ({ firstName, endsAt }: Props) => (
  <Layout preview="Votre abonnement Pro expire dans 3 jours">
    <Heading style={h1}>Renouvellement dans 3 jours ⏳</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Votre abonnement Pro AfriFlow arrive à échéance{endsAt ? ` le ${endsAt}` : ""}. Pensez à
      renouveler pour ne pas perdre votre numéro pro et vos minutes incluses.
    </Text>
    <Text style={muted}>Renouvellement en 1 clic depuis votre tableau de bord.</Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "⏳ Votre abonnement AfriFlow Pro expire dans 3 jours",
  displayName: "Abonnement — J-3",
  previewData: { firstName: "Awa", endsAt: "28 juin 2026" },
} satisfies TemplateEntry;
