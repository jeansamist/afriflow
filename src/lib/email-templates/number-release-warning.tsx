import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, muted } from "./_shared";

interface Props {
  firstName?: string;
  phoneNumber?: string;
  releaseDate?: string;
}

const Email = ({ firstName, phoneNumber, releaseDate }: Props) => (
  <Layout preview="Votre numéro sera libéré dans 3 jours">
    <Heading style={h1}>Votre numéro sera libéré dans 3 jours ⚠️</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Votre abonnement Pro AfriFlow est expiré depuis presque un mois. Sans renouvellement, votre
      numéro professionnel{phoneNumber ? ` ${phoneNumber}` : ""} sera définitivement retiré de votre
      compte{releaseDate ? ` le ${releaseDate}` : " dans 3 jours"}.
    </Text>
    <Text style={p}>
      Réactivez votre plan Pro dès maintenant depuis votre tableau de bord pour conserver ce numéro
      — vos clients continuent de l'utiliser pour vous joindre.
    </Text>
    <Text style={muted}>
      Après cette date, il faudra choisir un nouveau numéro lors d'une prochaine souscription.
    </Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "⚠️ Votre numéro AfriFlow sera libéré dans 3 jours",
  displayName: "Numéro — libération J-3",
  previewData: {
    firstName: "Awa",
    phoneNumber: "+33 1 62 29 05 88",
    releaseDate: "10 juillet 2026",
  },
} satisfies TemplateEntry;
