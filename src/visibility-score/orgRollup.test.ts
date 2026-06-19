import { describe, expect, it } from "vitest";
import { buildOrgVisibilityRollup } from "./index.js";

describe("buildOrgVisibilityRollup", () => {
  it("averages only scored locations, excluding null scores", () => {
    const rollup = buildOrgVisibilityRollup([
      { businessId: "b1", businessName: "Location A", score: 80 },
      { businessId: "b2", businessName: "Location B", score: 60 },
      { businessId: "b3", businessName: "Location C", score: null },
    ]);
    expect(rollup.locations).toHaveLength(3);
    expect(rollup.averageScore).toBe(70);
  });

  it("returns a null average when no location has a score yet", () => {
    const rollup = buildOrgVisibilityRollup([{ businessId: "b1", businessName: "Location A", score: null }]);
    expect(rollup.averageScore).toBeNull();
  });

  it("behaves identically to a single business view for an org of one", () => {
    const rollup = buildOrgVisibilityRollup([{ businessId: "b1", businessName: "Solo Biz", score: 92 }]);
    expect(rollup.locations).toEqual([{ businessId: "b1", businessName: "Solo Biz", score: 92 }]);
    expect(rollup.averageScore).toBe(92);
  });
});
