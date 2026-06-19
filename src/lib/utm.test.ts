import { describe, expect, it } from "vitest";
import { buildUtmLink } from "./utm.js";

describe("buildUtmLink", () => {
  it("appends required utm params", () => {
    const link = buildUtmLink("https://example.com/", { source: "facebook", medium: "social", campaign: "boost-1" });
    const url = new URL(link);
    expect(url.searchParams.get("utm_source")).toBe("facebook");
    expect(url.searchParams.get("utm_medium")).toBe("social");
    expect(url.searchParams.get("utm_campaign")).toBe("boost-1");
    expect(url.searchParams.get("utm_content")).toBeNull();
  });

  it("includes utm_content only when provided", () => {
    const link = buildUtmLink("https://example.com/", {
      source: "facebook",
      medium: "social",
      campaign: "boost-1",
      content: "post-42",
    });
    expect(new URL(link).searchParams.get("utm_content")).toBe("post-42");
  });

  it("preserves existing query params on the base URL", () => {
    const link = buildUtmLink("https://example.com/?ref=abc", { source: "x", medium: "y", campaign: "z" });
    const url = new URL(link);
    expect(url.searchParams.get("ref")).toBe("abc");
    expect(url.searchParams.get("utm_source")).toBe("x");
  });
});
