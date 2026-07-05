import * as React from "react";
import type { TemplateEntry } from "./registry";
import { Layout, Heading, Text, h1, p, card } from "./_shared";

interface Props {
  firstName?: string;
  status?: "APPROVED" | "REJECTED";
  reason?: string;
}

const Email = ({ firstName, status = "APPROVED", reason }: Props) => {
  const approved = status === "APPROVED";
  return (
    <Layout preview={approved ? "Votre identité est vérifiée" : "Action requise sur votre dossier KYC"}>
      <Heading style={h1}>{approved ? "Compte vérifié ✅" : "Dossier à compléter"}</Heading>
      <Text style={p}>Bonjour {firstName || "👋"},</Text>
      {approved ? (
        <Text style={p}>
          Votre identité a été vérifiée. Vous pouvez désormais recevoir des paiements supérieurs au seuil
          standard, sans limite.
        </Text>
      ) : (
        <>
          <Text style={p}>
            Votre dossier KYC n'a pas pu être validé. Merci de soumettre à nouveau les documents demandés.
          </Text>
          {reason ? (
            <div style={card}>
              <Text style={p}><strong>Motif :</strong> {reason}</Text>
            </div>
          ) : null}
        </>
      )}
    </Layout>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.status === "REJECTED" ? "Votre dossier KYC nécessite une action" : "Compte AfriFlow vérifié 🎉",
  displayName: "KYC update",
  previewData: { firstName: "Awa", status: "APPROVED" },
} satisfies TemplateEntry;
