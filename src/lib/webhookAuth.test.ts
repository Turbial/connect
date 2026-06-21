import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  verifyMetaWebhook,
  verifyReachWebhook,
  verifyTwilioWebhook,
  verifyBusinessRoute,
  verifyStripeWebhook,
  verifyCrmWebhook,
} from "./webhookAuth.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.WEBHOOK_BASE_URL;
  delete process.env.META_APP_SECRET;
  delete process.env.REACH_WEBHOOK_SECRET;
  delete process.env.CONNECT_AGENT_API_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.CRM_WEBHOOK_SECRET;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("verifyTwilioWebhook", () => {
  it("fails closed when TWILIO_AUTH_TOKEN/WEBHOOK_BASE_URL aren't configured", () => {
    expect(verifyTwilioWebhook("/webhooks/sms", new URLSearchParams({ From: "+15551234567" }), "anything")).toBe(false);
  });

  it("rejects a missing signature even when configured", () => {
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.WEBHOOK_BASE_URL = "https://example.com";
    expect(verifyTwilioWebhook("/webhooks/sms", new URLSearchParams({ From: "+15551234567" }), undefined)).toBe(false);
  });

  it("rejects an invalid signature", () => {
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.WEBHOOK_BASE_URL = "https://example.com";
    expect(verifyTwilioWebhook("/webhooks/sms", new URLSearchParams({ From: "+15551234567" }), "bogus")).toBe(false);
  });
});

describe("verifyMetaWebhook", () => {
  it("fails closed when META_APP_SECRET isn't configured", () => {
    expect(verifyMetaWebhook("{}", "sha256=anything")).toBe(false);
  });

  it("rejects a missing signature even when configured", () => {
    process.env.META_APP_SECRET = "secret";
    expect(verifyMetaWebhook("{}", undefined)).toBe(false);
  });

  it("accepts a correctly computed signature", () => {
    process.env.META_APP_SECRET = "secret";
    const body = '{"hello":"world"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(verifyMetaWebhook(body, signature)).toBe(true);
  });

  it("rejects a tampered body", () => {
    process.env.META_APP_SECRET = "secret";
    const signature = `sha256=${createHmac("sha256", "secret").update('{"hello":"world"}').digest("hex")}`;
    expect(verifyMetaWebhook('{"hello":"tampered"}', signature)).toBe(false);
  });
});

describe("verifyReachWebhook", () => {
  it("fails closed when REACH_WEBHOOK_SECRET isn't configured", () => {
    expect(verifyReachWebhook("Bearer anything")).toBe(false);
  });

  it("accepts a matching bearer token", () => {
    process.env.REACH_WEBHOOK_SECRET = "reach-secret";
    expect(verifyReachWebhook("Bearer reach-secret")).toBe(true);
  });

  it("rejects a non-matching bearer token", () => {
    process.env.REACH_WEBHOOK_SECRET = "reach-secret";
    expect(verifyReachWebhook("Bearer wrong")).toBe(false);
  });
});

describe("verifyBusinessRoute", () => {
  it("fails closed when CONNECT_AGENT_API_KEY isn't configured", () => {
    expect(verifyBusinessRoute("Bearer anything")).toBe(false);
  });

  it("accepts a matching bearer token", () => {
    process.env.CONNECT_AGENT_API_KEY = "agent-key";
    expect(verifyBusinessRoute("Bearer agent-key")).toBe(true);
  });
});

describe("verifyStripeWebhook", () => {
  it("fails closed when STRIPE_WEBHOOK_SECRET isn't configured", () => {
    expect(verifyStripeWebhook("{}", "t=1,v1=anything")).toBe(false);
  });

  it("rejects a missing signature header even when configured", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    expect(verifyStripeWebhook("{}", undefined)).toBe(false);
  });

  it("accepts a correctly computed signature", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const body = '{"hello":"world"}';
    const timestamp = "1700000000";
    const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.${body}`).digest("hex");
    expect(verifyStripeWebhook(body, `t=${timestamp},v1=${signature}`)).toBe(true);
  });

  it("rejects a tampered body", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const timestamp = "1700000000";
    const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.{"hello":"world"}`).digest("hex");
    expect(verifyStripeWebhook('{"hello":"tampered"}', `t=${timestamp},v1=${signature}`)).toBe(false);
  });
});

describe("verifyCrmWebhook", () => {
  it("fails closed when CRM_WEBHOOK_SECRET isn't configured", () => {
    expect(verifyCrmWebhook("Bearer anything")).toBe(false);
  });

  it("accepts a matching bearer token", () => {
    process.env.CRM_WEBHOOK_SECRET = "crm-secret";
    expect(verifyCrmWebhook("Bearer crm-secret")).toBe(true);
  });

  it("rejects a non-matching bearer token", () => {
    process.env.CRM_WEBHOOK_SECRET = "crm-secret";
    expect(verifyCrmWebhook("Bearer wrong")).toBe(false);
  });
});
