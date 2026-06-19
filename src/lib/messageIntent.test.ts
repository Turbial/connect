import { describe, expect, it, vi } from "vitest";
import { classifyMessageIntent, routeLeadIntentMessage } from "./messageIntent.js";
import type { Business, CustomerMessage } from "../types.js";

function makeMessage(overrides: Partial<CustomerMessage> = {}): CustomerMessage {
  return {
    id: "m1",
    business_id: "b1",
    channel: "sms",
    direction: "inbound",
    customer_identifier: "+15551234567",
    body: "Do you have any openings this week?",
    intent: "lead_intent",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("classifyMessageIntent", () => {
  it("returns null for a message with no body, never fabricating an intent", async () => {
    expect(await classifyMessageIntent(null)).toBeNull();
  });

  it("returns null when no DEEPSEEK_API_KEY is configured, rather than throwing", async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const result = await classifyMessageIntent("Do you have any openings this week?");
      expect(result).toBeNull();
    } finally {
      if (previous !== undefined) process.env.DEEPSEEK_API_KEY = previous;
    }
  });
});

describe("routeLeadIntentMessage", () => {
  it("never calls out when the business has no crm_webhook_url configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await routeLeadIntentMessage({ id: "b1", crm_webhook_url: null } as Business, makeMessage());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("never calls out for a non-lead_intent message even with a webhook configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await routeLeadIntentMessage({ id: "b1", crm_webhook_url: "https://example.com/hook" } as Business, makeMessage({ intent: "question" }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("POSTs the lead signal to the configured webhook without throwing on failure", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(
      routeLeadIntentMessage({ id: "b1", crm_webhook_url: "https://example.com/hook" } as Business, makeMessage())
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/hook", expect.objectContaining({ method: "POST" }));
    fetchSpy.mockRestore();
  });
});
