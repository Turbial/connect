import { describe, expect, it } from "vitest";
import { isOwnerVerified } from "./ownerVerification.js";
import type { Business } from "../types.js";

const business = { owner_verified_at: null } as Business;

describe("isOwnerVerified", () => {
  it("is false when owner_verified_at is unset", () => {
    expect(isOwnerVerified(business)).toBe(false);
  });

  it("is true once owner_verified_at is set", () => {
    expect(isOwnerVerified({ ...business, owner_verified_at: "2026-01-01T00:00:00Z" })).toBe(true);
  });
});
