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

  it("pulls the score toward the higher-weighted category for restaurants", () => {
    const breakdown = { reviews: 100, "website health": 0 };
    const restaurantScore = weightedScore(breakdown, weightTableFor("restaurant"));
    const generalScore = weightedScore(breakdown, weightTableFor("general"));
    expect(restaurantScore).toBeGreaterThan(generalScore);
  });

  it("pulls the score toward the higher-weighted category for wellness", () => {
    const breakdown = { "social activity": 100, "website health": 0 };
    const wellnessScore = weightedScore(breakdown, weightTableFor("wellness"));
    const generalScore = weightedScore(breakdown, weightTableFor("general"));
    expect(wellnessScore).toBeGreaterThan(generalScore);
  });

  it("produces genuinely different weightings across all three named verticals", () => {
    const breakdown = { listings: 100, reviews: 100, "social activity": 0 };
    const homeServicesScore = weightedScore(breakdown, weightTableFor("home_services"));
    const restaurantScore = weightedScore(breakdown, weightTableFor("restaurant"));
    const wellnessScore = weightedScore(breakdown, weightTableFor("wellness"));
    expect(new Set([homeServicesScore, restaurantScore, wellnessScore]).size).toBeGreaterThan(1);
  });
});

describe("industryInsightFor", () => {
  it("returns tuned copy for home services", () => {
    expect(industryInsightFor("home_services")).toMatch(/home services/i);
  });

  it("returns tuned copy for restaurant", () => {
    expect(industryInsightFor("restaurant")).toMatch(/restaurant/i);
  });

  it("returns tuned copy for wellness", () => {
    expect(industryInsightFor("wellness")).toMatch(/wellness/i);
  });

  it("returns null for general, never a fabricated claim", () => {
    expect(industryInsightFor("general")).toBeNull();
    expect(industryInsightFor(null)).toBeNull();
  });
});
