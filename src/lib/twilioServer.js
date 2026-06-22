import twilio from "twilio";
import { requireEnv } from "./env";

export function getTwilioClient() {
  return twilio(requireEnv("TWILIO_ACCOUNT_SID"), requireEnv("TWILIO_AUTH_TOKEN"));
}

export function hasTwilioServerEnv() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export function verifyTwilioRequest(req, url, params) {
  const signature = req.headers["x-twilio-signature"];

  if (!signature || !process.env.TWILIO_AUTH_TOKEN) {
    return false;
  }

  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, params);
}

export function toTwilioStatus(status) {
  const normalized = String(status || "").toLowerCase().replace(/-/g, "_");
  const allowed = new Set(["queued", "ringing", "in_progress", "completed", "busy", "failed", "no_answer", "canceled"]);
  return allowed.has(normalized) ? normalized : "queued";
}

export function toTwilioSmsStatus(status) {
  const normalized = String(status || "").toLowerCase().replace(/-/g, "_");
  const allowed = new Set(["queued", "sent", "delivered", "failed", "undelivered"]);
  return allowed.has(normalized) ? normalized : "queued";
}
