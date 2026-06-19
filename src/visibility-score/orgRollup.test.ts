import { describe, expect, it } from "vitest";
import { buildOrgVisibilityRollup, rankOrgLocations } from "./index.js";

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

describe("rankOrgLocations", () => {
  it("ranks scored locations highest-score-first and computes the gap from the org average", () => {
    const rollup = buildOrgVisibilityRollup([
      { businessId: "b1", businessName: "Location A", score: 80 },
      { businessId: "b2", businessName: "Location B", score: 60 },
    ]);
    const ranked = rankOrgLocations(rollup);
    expect(ranked).toEqual([
      { businessId: "b1", businessName: "Location A", score: 80, rank: 1, gapFromOrgAverage: 10 },
      { businessId: "b2", businessName: "Location B", score: 60, rank: 2, gapFromOrgAverage: -10 },
    ]);
  });

  it("never ranks an unscored location ahead of a scored one, and gives it no rank or gap", () => {
    const rollup = buildOrgVisibilityRollup([
      { businessId: "b1", businessName: "Unscored", score: null },
      { businessId: "b2", businessName: "Scored", score: 75 },
    ]);
    const ranked = rankOrgLocations(rollup);
    expect(ranked.map((l) => l.businessId)).toEqual(["b2", "b1"]);
    expect(ranked.find((l) => l.businessId === "b1")).toEqual({
      businessId: "b1",
      businessName: "Unscored",
      score: null,
      rank: null,
      gapFromOrgAverage: null,
    });
  });

  it("ranks an org of one location #1 by construction", () => {
    const rollup = buildOrgVisibilityRollup([{ businessId: "b1", businessName: "Solo Biz", score: 92 }]);
    const ranked = rankOrgLocations(rollup);
    expect(ranked).toEqual([{ businessId: "b1", businessName: "Solo Biz", score: 92, rank: 1, gapFromOrgAverage: 0 }]);
  });
});
