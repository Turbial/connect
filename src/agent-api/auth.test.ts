import { describe, expect, it } from "vitest";
import { isAuthorized, parseBearerToken } from "./auth.js";

describe("parseBearerToken", () => {
  it("extracts the token from a Bearer header", () => {
    expect(parseBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("returns null for a missing header", () => {
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  it("returns null for a non-Bearer scheme", () => {
    expect(parseBearerToken("Basic abc123")).toBeNull();
  });
});

describe("isAuthorized", () => {
  it("fails closed when no API key is configured, even with a token presented", () => {
    expect(isAuthorized("anything", undefined)).toBe(false);
  });

  it("rejects a missing token even when a key is configured", () => {
    expect(isAuthorized(null, "secret")).toBe(false);
  });

  it("accepts a token that matches the configured key", () => {
    expect(isAuthorized("secret", "secret")).toBe(true);
  });

  it("rejects a token that doesn't match", () => {
    expect(isAuthorized("wrong", "secret")).toBe(false);
  });

  it("rejects a token of different length without throwing", () => {
    expect(isAuthorized("short", "much-longer-secret-key")).toBe(false);
  });
});
