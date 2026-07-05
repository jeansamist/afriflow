import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

export const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif", color: "#0E1218" };
export const container = { maxWidth: "560px", margin: "0 auto", padding: "32px 24px" };
export const card = {
  backgroundColor: "#F7F8FA",
  border: "1px solid #E4E7EB",
  borderRadius: "12px",
  padding: "20px",
  margin: "16px 0",
};
export const brand = { fontSize: "12px", letterSpacing: "0.12em", color: "#6B7280", textTransform: "uppercase" as const };
export const h1 = { fontSize: "22px", fontWeight: 700, margin: "12px 0 8px" };
export const p = { fontSize: "15px", lineHeight: "22px", color: "#1F2937", margin: "8px 0" };
export const muted = { fontSize: "13px", color: "#6B7280", margin: "12px 0 0" };

export function Layout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>AfriFlow</Text>
          {children}
          <Text style={muted}>AfriFlow · La cabine pro des freelances africains.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export { Heading, Section, Text };
