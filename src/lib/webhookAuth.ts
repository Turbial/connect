import twilio from "twilio";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isAuthorized, parseBearerToken } from "../agent-api/auth.js";

/** Phase 15 security hardening: verifies an inbound Twilio webhook (SMS or
 * missed-call) actually came from Twilio, via Twilio's own request-signature
 * scheme. Fails closed — if TWILIO_AUTH_TOKEN or WEBHOOK_BASE_URL isn't
 * configured, the request is never treated as verified, rather than the
 * webhook silently trusting an unauthenticated From/Body. */
export function verifyTwilioWebhook(path: string, params: URLSearchParams, signature: string | undefined | null): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const baseUrl = process.env.WEBHOOK_BASE_URL;
  if (!authToken || !baseUrl || !signature) return false;
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const paramsObject: Record<string, string> = {};
  for (const [key, value] of params) paramsObject[key] = value;
  return twilio.validateRequest(authToken, signature, url, paramsObject);
}

/** Verifies an inbound Meta (WhatsApp) webhook via its X-Hub-Signature-256
 * HMAC-SHA256 over the raw request body. Fails closed if META_APP_SECRET
 * isn't configured. */
export function verifyMetaWebhook(rawBody: string, signatureHeader: string | undefined | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;
  const match = /^sha256=(.+)$/.exec(signatureHeader.trim());
  if (!match) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(match[1]);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/** Verifies an inbound Reach webhook via a shared-secret bearer token. Fails
 * closed if REACH_WEBHOOK_SECRET isn't configured. */
export function verifyReachWebhook(authorizationHeader: string | undefined | null): boolean {
  return isAuthorized(parseBearerToken(authorizationHeader), process.env.REACH_WEBHOOK_SECRET);
}

/** Verifies a business/organization-scoped route call via the same
 * agent-api bearer token. Fails closed if CONNECT_AGENT_API_KEY isn't
 * configured. */
export function verifyBusinessRoute(authorizationHeader: string | undefined | null): boolean {
  return isAuthorized(parseBearerToken(authorizationHeader), process.env.CONNECT_AGENT_API_KEY);
}
