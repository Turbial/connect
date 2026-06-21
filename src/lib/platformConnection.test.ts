import { describe, expect, it } from "vitest";
import { classifyFailure } from "./platformConnection.js";

describe("classifyFailure", () => {
  it("classifies a permission/scope error as missing_permissions", () => {
    expect(classifyFailure("Missing permission: pages_manage_posts")).toBe("missing_permissions");
    expect(classifyFailure("Insufficient scope for this request")).toBe("missing_permissions");
  });

  it("classifies a refresh-token error as failed_refresh", () => {
    expect(classifyFailure("Unable to refresh access token")).toBe("failed_refresh");
  });

  it("falls back to a generic failed status for an unrecognized error", () => {
    expect(classifyFailure("Rate limit exceeded")).toBe("failed");
  });
});
