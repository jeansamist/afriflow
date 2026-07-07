import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, card } from "./_shared";

interface Props {
  firstName?: string;
  includedMinutes?: number;
  cycleEnd?: string;
}

const Email = ({ firstName, includedMinutes = 150, cycleEnd }: Props) => (
  <Layout preview="Votre abonnement Pro est actif">
    <Heading style={h1}>Bienvenue dans Pro 🎉</Heading>
    <Text style={p}>Bonjour {firstName || "et bienvenue"},</Text>
    <Text style={p}>
      Votre abonnement Pro AfriFlow est activé. Vous pouvez recevoir des paiements et appeler vos
      clients avec votre numéro pro.
    </Text>
    <div style={card}>
      <Text style={p}>
        <strong>{includedMinutes} minutes</strong> incluses ce cycle.
      </Text>
      {cycleEnd ? (
        <Text style={p}>
          Prochain renouvellement : {new Date(cycleEnd).toLocaleDateString("fr-FR")}
        </Text>
      ) : null}
    </div>
  </Layout>
);

export const template = {
  component: Email,
  subject: "Votre abonnement Pro est actif ✨",
  displayName: "Pro activé",
  previewData: { firstName: "Awa", includedMinutes: 150, cycleEnd: new Date().toISOString() },
} satisfies TemplateEntry;
