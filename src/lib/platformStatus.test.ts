import { describe, expect, it } from "vitest";
import { isLivePlatform, platformStatusReport, statusOf } from "./platformStatus.js";

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

describe("platformStatusReport", () => {
  it("counts verified and organic-only platforms from real tagging only", () => {
    const report = platformStatusReport();
    expect(report.verifiedCount).toBeGreaterThan(0);
    expect(report.organicOnlyCount).toBeGreaterThan(0);
    expect(report.totalAdaptersBuilt).toBe(report.verifiedCount + report.organicOnlyCount);
  });

  it("never includes stub platforms in gatedPlatforms", () => {
    const report = platformStatusReport();
    expect(report.gatedPlatforms.some((g) => g.platform === "amazon")).toBe(false);
  });

  it("gives every gated platform a non-empty reason", () => {
    const report = platformStatusReport();
    for (const entry of report.gatedPlatforms) {
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });
});
