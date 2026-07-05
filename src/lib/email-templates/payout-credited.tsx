import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, card } from "./_shared";

interface Props {
  firstName?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  mobileMoneyNumber?: string;
}

const Email = ({ firstName, amount = 0, currency = "EUR", reference, mobileMoneyNumber }: Props) => (
  <Layout preview="Virement Mobile Money envoyé">
    <Heading style={h1}>Virement envoyé ✅</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Nous venons d'envoyer <strong>{amount} {currency}</strong> sur votre compte Mobile Money
      {mobileMoneyNumber ? <> ({mobileMoneyNumber})</> : null}.
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
  subject: "Votre virement Mobile Money est parti 💸",
  displayName: "Payout crédité",
  previewData: { firstName: "Awa", amount: 95.7, currency: "EUR", reference: "FW-SIM-XYZ", mobileMoneyNumber: "+225 0700000000" },
} satisfies TemplateEntry;
