import * as React from "react";
import { Button } from "@react-email/components";
import { Layout, Heading, Text, h1, p, muted } from "./_shared";

interface Props {
  firstName?: string;
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

const Email = ({ firstName, actionUrl = "#" }: Props) => (
  <Layout preview="Confirmez votre adresse email pour activer votre cabine AfriFlow">
    <Heading style={h1}>Bienvenue sur AfriFlow 👋</Heading>
    <Text style={p}>Bonjour {firstName || "👋"},</Text>
    <Text style={p}>
      Merci de vous être inscrit. Cliquez sur le bouton ci-dessous pour confirmer votre adresse
      email et activer votre cabine.
    </Text>
    <Button href={actionUrl} style={button}>
      Confirmer mon email
    </Button>
    <Text style={muted}>
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : {actionUrl}
    </Text>
    <Text style={muted}>
      Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
    </Text>
  </Layout>
);

export const template = {
  component: Email,
  subject: "Confirmez votre email · AfriFlow",
  displayName: "Auth — confirmation d'inscription",
  previewData: { firstName: "Awa", actionUrl: "https://example.com/verify" },
};
