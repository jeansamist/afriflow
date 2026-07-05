import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, card } from "./_shared";

interface Props {
  firstName?: string;
  minutes?: number;
  reference?: string;
}

const Email = ({ firstName, minutes = 0, reference }: Props) => (
  <Layout preview="Recharge minutes confirmée">
    <Heading style={h1}>Recharge confirmée</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Vos <strong>{minutes} minutes</strong> ont été créditées sur votre wallet et n'expirent jamais.
    </Text>
    {reference ? (
      <div style={card}>
        <Text style={p}>Référence : <strong>{reference}</strong></Text>
      </div>
    ) : null}
  </Layout>
);

export const template = {
  component: Email,
  subject: "Recharge minutes confirmée",
  displayName: "Reçu top-up",
  previewData: { firstName: "Awa", minutes: 100, reference: "TOPUP-ABC123" },
} satisfies TemplateEntry;
