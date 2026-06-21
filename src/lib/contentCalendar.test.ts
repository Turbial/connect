import { describe, expect, it } from "vitest";
import { cadenceSlotsPerWeek } from "./contentCalendar.js";
import type { Business } from "../types.js";

function businessWithCadence(posting_cadence: string | null): Business {
  return { posting_cadence } as Business;
}

describe("cadenceSlotsPerWeek", () => {
  it("defaults to 3/week when no cadence is set, matching pre-7.5 behavior", () => {
    expect(cadenceSlotsPerWeek(businessWithCadence(null))).toBe(3);
  });

  it("defaults to 3/week when the cadence has no parseable number", () => {
    expect(cadenceSlotsPerWeek(businessWithCadence("whenever it makes sense"))).toBe(3);
  });

  it("parses a leading number out of free-text cadence", () => {
    expect(cadenceSlotsPerWeek(businessWithCadence("5x per week"))).toBe(5);
    expect(cadenceSlotsPerWeek(businessWithCadence("2 posts/week"))).toBe(2);
  });
});
