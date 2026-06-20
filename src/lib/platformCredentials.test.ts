import { describe, expect, it } from "vitest";
import { credentialFieldsFor, setPlatformCredentials } from "./platformCredentials.js";

describe("credentialFieldsFor", () => {
  it("returns the multi-field override for gbp", () => {
    expect(credentialFieldsFor("gbp")).toEqual(["gbp_access_token", "gbp_refresh_token", "gbp_location_id"]);
  });

  it("returns the multi-field override for facebook and instagram", () => {
    expect(credentialFieldsFor("facebook")).toEqual(["fb_page_access_token", "fb_page_id"]);
    expect(credentialFieldsFor("instagram")).toEqual(["fb_page_access_token", "ig_business_id"]);
  });

  it("falls back to the default single-token column for an un-overridden platform", () => {
    expect(credentialFieldsFor("pinterest")).toEqual(["pinterest_access_token"]);
  });
});

describe("setPlatformCredentials", () => {
  it("rejects a field that isn't valid for the given platform, before touching the database", async () => {
    await expect(setPlatformCredentials("b1", "pinterest", { fb_page_access_token: "x" })).rejects.toThrow(/not a valid credential field/);
  });

  it("rejects an empty values object, before touching the database", async () => {
    await expect(setPlatformCredentials("b1", "pinterest", {})).rejects.toThrow(/No valid credential fields/);
  });
});
