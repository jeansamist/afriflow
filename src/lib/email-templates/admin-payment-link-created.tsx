import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, card, muted } from "./_shared";

interface Props {
  userName?: string | null;
  userEmail?: string | null;
  amount?: number;
  currency?: string;
  description?: string | null;
  localAmount?: number | null;
  localCurrency?: string | null;
  linkUrl?: string | null;
}

const Email = ({
  userName,
  userEmail,
  amount,
  currency,
  description,
  localAmount,
  localCurrency,
  linkUrl,
}: Props) => (
  <Layout preview="Un nouveau lien de paiement vient d'être créé">
    <Heading style={h1}>Nouveau lien de paiement 💳</Heading>
    <Text style={p}>
      {userName || "Un utilisateur"} vient de créer un lien de paiement
      {amount != null ? (
        <>
          {" "}
          de <strong>{`${amount.toFixed(2)} ${currency ?? ""}`.trim()}</strong>
        </>
      ) : null}
      .
    </Text>
    <div style={card}>
      {userName ? (
        <Text style={p}>
          <strong>Utilisateur :</strong> {userName}
        </Text>
      ) : null}
      {userEmail ? (
        <Text style={p}>
          <strong>Email :</strong> {userEmail}
        </Text>
      ) : null}
      {description ? (
        <Text style={p}>
          <strong>Description :</strong> {description}
        </Text>
      ) : null}
      {amount != null ? (
        <Text style={p}>
          <strong>Montant :</strong> {amount.toFixed(2)} {currency ?? ""}
          {localAmount != null && localCurrency && localCurrency !== currency
            ? ` (≈ ${localAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${localCurrency})`
            : ""}
        </Text>
      ) : null}
    </div>
    {linkUrl ? (
      <Text style={p}>
        <a href={linkUrl} style={{ color: "#2563EB" }}>
          Voir la page de paiement →
        </a>
      </Text>
    ) : null}
    <Text style={muted}>Vous recevez cet email car vous êtes administrateur AfriFlow.</Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Nouveau lien de paiement${
      d?.amount != null
        ? ` — ${Number(d.amount).toFixed(2)} ${String(d?.currency ?? "")}`.trimEnd()
        : ""
    }`,
  displayName: "Admin — Lien de paiement créé",
  previewData: {
    userName: "Koffi N'Guessan",
    userEmail: "koffi@exemple.com",
    amount: 120,
    currency: "EUR",
    description: "Acompte site vitrine",
    localAmount: 78600,
    localCurrency: "XOF",
    linkUrl: "https://afriflow.tech/pay/00000000-0000-0000-0000-000000000000",
  },
} satisfies TemplateEntry;
