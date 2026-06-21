import { describe, expect, it } from "vitest";
import { hasFeature } from "./packages.js";
import type { Business } from "../types.js";

function businessWithTier(tier: Business["package_tier"]): Business {
  return { package_tier: tier } as Business;
}

describe("hasFeature", () => {
  it("treats no package_tier as starter_audit, not full access", () => {
    const business = businessWithTier(null);
    expect(hasFeature(business, "visibility_audit")).toBe(true);
    expect(hasFeature(business, "boost_proposals")).toBe(false);
  });

  it("starter_audit excludes content generation and boosts", () => {
    const business = businessWithTier("starter_audit");
    expect(hasFeature(business, "content_generation")).toBe(false);
    expect(hasFeature(business, "boost_proposals")).toBe(false);
  });

  it("local_operator includes the full Phase 6 feature surface", () => {
    const business = businessWithTier("local_operator");
    expect(hasFeature(business, "visibility_audit")).toBe(true);
    expect(hasFeature(business, "content_generation")).toBe(true);
    expect(hasFeature(business, "boost_proposals")).toBe(true);
  });

  it("agency adds white-label and multi-location on top of local_operator", () => {
    const business = businessWithTier("agency");
    expect(hasFeature(business, "white_label_reports")).toBe(true);
    expect(hasFeature(business, "multi_location_rollup")).toBe(true);
    expect(hasFeature(business, "boost_proposals")).toBe(true);
  });
});
