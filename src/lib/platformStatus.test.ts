import { describe, expect, it } from "vitest";
import { isLivePlatform, statusOf } from "./platformStatus.js";

describe("statusOf", () => {
  it("returns the explicitly tagged status for a Tier-1 platform", () => {
    expect(statusOf("facebook")).toBe("verified");
    expect(statusOf("gbp")).toBe("sandbox");
    expect(statusOf("tiktok")).toBe("partner_gated");
  });

  it("defaults untagged platforms to stub", () => {
    expect(statusOf("amazon")).toBe("stub");
    expect(statusOf("kik")).toBe("stub");
  });
});

describe("isLivePlatform", () => {
  it("treats verified, sandbox, and partner_gated as live", () => {
    expect(isLivePlatform("facebook")).toBe(true);
    expect(isLivePlatform("gbp")).toBe(true);
    expect(isLivePlatform("tiktok")).toBe(true);
  });

  it("treats stub platforms as not live", () => {
    expect(isLivePlatform("amazon")).toBe(false);
  });
});
