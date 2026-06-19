import { describe, expect, it } from "vitest";
import { industryInsightFor, weightedScore, weightTableFor } from "./weights.js";

describe("weightedScore", () => {
  it("matches a plain mean under equal weights (general vertical)", () => {
    const breakdown = { listings: 80, reviews: 40 };
    expect(weightedScore(breakdown, weightTableFor("general"))).toBe(60);
  });

  it("pulls the score toward the higher-weighted category for home services", () => {
    const breakdown = { listings: 100, "social activity": 0 };
    const homeServicesScore = weightedScore(breakdown, weightTableFor("home_services"));
    const generalScore = weightedScore(breakdown, weightTableFor("general"));
    expect(homeServicesScore).toBeGreaterThan(generalScore);
  });

  it("treats restaurant/wellness as unweighted stubs, same as general", () => {
    const breakdown = { listings: 80, reviews: 40 };
    expect(weightedScore(breakdown, weightTableFor("restaurant"))).toBe(weightedScore(breakdown, weightTableFor("general")));
    expect(weightedScore(breakdown, weightTableFor("wellness"))).toBe(weightedScore(breakdown, weightTableFor("general")));
  });
});

describe("industryInsightFor", () => {
  it("returns tuned copy for home services", () => {
    expect(industryInsightFor("home_services")).toMatch(/home services/i);
  });

  it("returns null for verticals without tuned copy yet, never a fabricated claim", () => {
    expect(industryInsightFor("restaurant")).toBeNull();
    expect(industryInsightFor("wellness")).toBeNull();
    expect(industryInsightFor("general")).toBeNull();
    expect(industryInsightFor(null)).toBeNull();
  });
});
