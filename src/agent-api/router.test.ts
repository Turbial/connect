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
});
