import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p } from "./_shared";

interface Props {
  firstName?: string;
  minutesRemaining?: number;
}

const Email = ({ firstName, minutesRemaining = 0 }: Props) => (
  <Layout preview="Vos minutes baissent">
    <Heading style={h1}>Plus que {minutesRemaining} min</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Il vous reste <strong>{minutesRemaining} minutes</strong>. Rechargez à tout moment pour ne pas
      interrompre vos appels — les minutes achetées n'expirent jamais.
    </Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "⏳ Vos minutes baissent",
  displayName: "Alerte minutes basses",
  previewData: { firstName: "Awa", minutesRemaining: 15 },
} satisfies TemplateEntry;
