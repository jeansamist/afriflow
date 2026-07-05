import twilio from "twilio";

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not configured`);
  return v;
}

export function generateVoiceToken(identity: string): string {
  const accountSid = getEnv("TWILIO_ACCOUNT_SID");
  const apiKeySid = getEnv("TWILIO_API_KEY_SID");
  const apiKeySecret = getEnv("TWILIO_API_KEY_SECRET");
  const twimlAppSid = getEnv("TWILIO_TWIML_APP_SID");

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: 3600,
  });

  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    }),
  );

  return token.toJwt();
}
