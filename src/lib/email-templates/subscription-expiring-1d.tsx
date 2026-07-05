import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, muted } from "./_shared";

interface Props {
  firstName?: string;
  endsAt?: string;
}

const Email = ({ firstName, endsAt }: Props) => (
  <Layout preview="Votre abonnement Pro expire demain">
    <Heading style={h1}>Dernier jour avant expiration ⚠️</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Votre abonnement Pro AfriFlow expire demain{endsAt ? ` (${endsAt})` : ""}. Sans
      renouvellement, votre numéro sera mis en pause et vous ne pourrez plus émettre d'appels.
    </Text>
    <Text style={muted}>Renouvelez maintenant pour garder votre activité fluide.</Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "⚠️ Votre abonnement AfriFlow Pro expire demain",
  displayName: "Abonnement — J-1",
  previewData: { firstName: "Awa", endsAt: "26 juin 2026" },
} satisfies TemplateEntry;
