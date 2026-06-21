import { describe, expect, it } from "vitest";
import { isKnownToolName, matchRoute } from "./router.js";

describe("matchRoute", () => {
  it("matches the health check", () => {
    expect(matchRoute("GET", "/health")).toEqual({ kind: "health" });
  });

  it("matches the tool list", () => {
    expect(matchRoute("GET", "/tools")).toEqual({ kind: "list_tools" });
  });

  it("matches a tool call and extracts the tool name", () => {
    expect(matchRoute("POST", "/tools/queue_content")).toEqual({ kind: "call_tool", toolName: "queue_content" });
  });

  it("ignores a trailing slash and query string", () => {
    expect(matchRoute("POST", "/tools/queue_content/?foo=bar")).toEqual({ kind: "call_tool", toolName: "queue_content" });
  });

  it("returns null for an unmatched path", () => {
    expect(matchRoute("GET", "/nope")).toBeNull();
  });

  it("returns null when the method doesn't match the route", () => {
    expect(matchRoute("GET", "/tools/queue_content")).toBeNull();
  });

  it("matches platform credential-field discovery and extracts the platform", () => {
    expect(matchRoute("GET", "/platforms/facebook/credential-fields")).toEqual({
      kind: "platform_credential_fields",
      platform: "facebook",
    });
  });

  it("matches business creation", () => {
    expect(matchRoute("POST", "/businesses")).toEqual({ kind: "create_business" });
  });

  it("matches sending an owner verification code and extracts the business id", () => {
    expect(matchRoute("POST", "/businesses/abc-123/owner-verification/send")).toEqual({
      kind: "send_owner_verification",
      businessId: "abc-123",
    });
  });

  it("matches confirming an owner verification code and extracts the business id", () => {
    expect(matchRoute("POST", "/businesses/abc-123/owner-verification/confirm")).toEqual({
      kind: "confirm_owner_verification",
      businessId: "abc-123",
    });
  });
});

describe("isKnownToolName", () => {
  it("accepts a registered tool name", () => {
    expect(isKnownToolName("propose_boost")).toBe(true);
  });

  it("accepts set_platform_credentials", () => {
    expect(isKnownToolName("set_platform_credentials")).toBe(true);
  });

  it("rejects an unregistered name", () => {
    expect(isKnownToolName("delete_everything")).toBe(false);
  });

  it("accepts tools added in later phases, not just the original 8", () => {
    expect(isKnownToolName("add_competitor")).toBe(true);
    expect(isKnownToolName("track_rank")).toBe(true);
    expect(isKnownToolName("flag_trending_content")).toBe(true);
    expect(isKnownToolName("get_revenue_by_platform")).toBe(true);
  });
});
