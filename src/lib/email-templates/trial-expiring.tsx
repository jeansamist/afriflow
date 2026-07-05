import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p } from "./_shared";

interface Props {
  firstName?: string;
  daysRemaining?: number;
}

const Email = ({ firstName, daysRemaining = 1 }: Props) => (
  <Layout preview="Votre essai se termine bientôt">
    <Heading style={h1}>Votre essai se termine dans {daysRemaining} j</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Activez Pro pour conserver votre numéro pro, recevoir des paiements et obtenir 500 minutes
      incluses chaque mois.
    </Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "⏰ Votre essai AfriFlow se termine bientôt",
  displayName: "Essai bientôt expiré",
  previewData: { firstName: "Awa", daysRemaining: 2 },
} satisfies TemplateEntry;
