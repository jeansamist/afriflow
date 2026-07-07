import * as React from "react";
import { Button } from "@react-email/components";
import { Layout, Heading, Text, h1, p, muted } from "./_shared";

interface Props {
  actionUrl?: string;
}

const button = {
  backgroundColor: "#0E1218",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
  display: "inline-block",
  margin: "16px 0",
};

const Email = ({ actionUrl = "#" }: Props) => (
  <Layout preview="Réinitialisez votre mot de passe AfriFlow">
    <Heading style={h1}>Réinitialiser votre mot de passe</Heading>
    <Text style={p}>
      Vous avez demandé la réinitialisation de votre mot de passe AfriFlow. Cliquez sur le bouton
      ci-dessous pour en définir un nouveau. Ce lien expire rapidement.
    </Text>
    <Button href={actionUrl} style={button}>
      Définir un nouveau mot de passe
    </Button>
    <Text style={muted}>
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : {actionUrl}
    </Text>
    <Text style={muted}>
      Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre mot de passe
      restera inchangé.
    </Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "Réinitialisation de votre mot de passe · AfriFlow",
  displayName: "Auth — mot de passe oublié",
  previewData: { actionUrl: "https://example.com/reset" },
};
