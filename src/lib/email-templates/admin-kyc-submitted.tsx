import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, card, muted } from "./_shared";

interface Props {
  userName?: string | null;
  userEmail?: string | null;
  operator?: string | null;
  mobileMoneyNumber?: string | null;
  reviewUrl?: string | null;
}

const Email = ({ userName, userEmail, operator, mobileMoneyNumber, reviewUrl }: Props) => (
  <Layout preview="Un nouveau dossier KYC attend votre validation">
    <Heading style={h1}>Nouveau dossier KYC 🪪</Heading>
    <Text style={p}>
      {userName || "Un utilisateur"} vient de soumettre son dossier de vérification d'identité. Il
      est en attente d'examen.
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
      {operator ? (
        <Text style={p}>
          <strong>Mobile Money :</strong> {operator}
          {mobileMoneyNumber ? ` · ${mobileMoneyNumber}` : ""}
        </Text>
      ) : null}
    </div>
    {reviewUrl ? (
      <Text style={p}>
        <a href={reviewUrl} style={{ color: "#2563EB" }}>
          Examiner le dossier dans le back-office →
        </a>
      </Text>
    ) : (
      <Text style={p}>Connectez-vous au back-office (Admin → KYC) pour l'examiner.</Text>
    )}
    <Text style={muted}>Vous recevez cet email car vous êtes administrateur AfriFlow.</Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Nouveau dossier KYC à examiner${d?.userName ? ` — ${String(d.userName)}` : ""}`,
  displayName: "Admin — KYC soumis",
  previewData: {
    userName: "Awa Ndiaye",
    userEmail: "awa@exemple.com",
    operator: "Orange Money",
    mobileMoneyNumber: "+221 77 000 00 00",
    reviewUrl: "https://afriflow.tech/admin/kyc",
  },
} satisfies TemplateEntry;
