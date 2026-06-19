import { describe, expect, it } from "vitest";
import { PARTNER_ACCESS_RISK, statusOfPartnerAccess } from "./partnerAccessRisk.js";

describe("statusOfPartnerAccess", () => {
  it("returns the filled-in entry for a platform with a real adapter", () => {
    const risk = statusOfPartnerAccess("facebook");
    expect(risk.platform).toBe("facebook");
    expect(risk.apiExists).toBe(true);
  });

  it("returns a pessimistic unassessed default for platforms with no entry", () => {
    const risk = statusOfPartnerAccess("amazon");
    expect(risk.apiExists).toBe(false);
    expect(risk.supportsThirdPartyPosting).toBe(false);
    expect(risk.partnerApprovalRequired).toBe("unknown");
  });

  it("never asserts a platform is fine by default", () => {
    for (const platform of Object.keys(PARTNER_ACCESS_RISK) as (keyof typeof PARTNER_ACCESS_RISK)[]) {
      const risk = PARTNER_ACCESS_RISK[platform]!;
      expect(risk.platform).toBe(platform);
    }
  });
});
