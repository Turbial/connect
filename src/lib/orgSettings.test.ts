import { describe, expect, it } from "vitest";
import { orgDisplayName, resolveBusinessSetting } from "./orgSettings.js";
import type { Business, Organization } from "../types.js";

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return { boost_budget_cents: null, ...overrides } as Business;
}

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return { boost_budget_cents: null, white_label_name: null, ...overrides } as Organization;
}

describe("resolveBusinessSetting", () => {
  it("prefers the business-level override when set", () => {
    const business = makeBusiness({ boost_budget_cents: 3000 });
    const organization = makeOrg({ boost_budget_cents: 5000 });
    expect(resolveBusinessSetting(business, organization, "boost_budget_cents", 2000)).toBe(3000);
  });

  it("falls back to the org-level default when business-level is null", () => {
    const business = makeBusiness({ boost_budget_cents: null });
    const organization = makeOrg({ boost_budget_cents: 5000 });
    expect(resolveBusinessSetting(business, organization, "boost_budget_cents", 2000)).toBe(5000);
  });

  it("falls back to the hardcoded constant when neither is set", () => {
    const business = makeBusiness({ boost_budget_cents: null });
    expect(resolveBusinessSetting(business, null, "boost_budget_cents", 2000)).toBe(2000);
  });
});

describe("orgDisplayName", () => {
  it("returns the white-label name when set", () => {
    expect(orgDisplayName(makeOrg({ white_label_name: "Acme Marketing" }))).toBe("Acme Marketing");
  });

  it("defaults to MightyMax when no organization or no white-label name", () => {
    expect(orgDisplayName(null)).toBe("MightyMax");
    expect(orgDisplayName(makeOrg({ white_label_name: null }))).toBe("MightyMax");
  });
});
