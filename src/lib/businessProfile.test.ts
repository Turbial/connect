import { describe, expect, it } from "vitest";
import { createBusinessProfile, type BusinessProfileInput } from "./businessProfile.js";

const baseInput: BusinessProfileInput = {
  name: "Joe's Plumbing",
  serviceArea: "Austin, TX",
  phone: "+15125550100",
  website: null,
  ownerMobile: "+15125550199",
  ownerPreferredChannel: "sms",
  servicesOffered: ["drain cleaning"],
  brandTone: null,
  bannedWords: [],
  bannedClaims: [],
  logoUrl: null,
  photoUrls: [],
  competitorNames: [],
  targetLocations: [],
  postingCadence: null,
  complianceRestrictions: [],
  organizationId: null,
};

describe("createBusinessProfile", () => {
  it("rejects a missing required field instead of silently defaulting it", async () => {
    await expect(createBusinessProfile({ ...baseInput, name: "" })).rejects.toThrow(/name/);
  });

  it("rejects a missing owner preferred channel", async () => {
    await expect(createBusinessProfile({ ...baseInput, ownerPreferredChannel: undefined as never })).rejects.toThrow(
      /ownerPreferredChannel/
    );
  });
});
