import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, muted } from "./_shared";

interface Props {
  firstName?: string;
  phoneNumber?: string;
}

const Email = ({ firstName, phoneNumber }: Props) => (
  <Layout preview="Votre numéro a été libéré">
    <Heading style={h1}>Votre numéro a été libéré</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Sans renouvellement de votre abonnement Pro depuis plus d'un mois, votre numéro professionnel
      {phoneNumber ? ` ${phoneNumber}` : ""} a été retiré de votre compte AfriFlow.
    </Text>
    <Text style={p}>
      Vous pouvez revenir à tout moment : souscrivez de nouveau au plan Pro et choisissez un nouveau
      numéro professionnel en quelques minutes.
    </Text>
    <Text style={muted}>
      Toutes vos autres données (CRM, historique, paiements) sont conservées.
    </Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "Votre numéro AfriFlow a été libéré",
  displayName: "Numéro — libéré",
  previewData: { firstName: "Awa", phoneNumber: "+33 1 62 29 05 88" },
} satisfies TemplateEntry;
