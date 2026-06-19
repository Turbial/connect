import { describe, expect, it } from "vitest";
import { classifyChatIntent, renderScoreCard, renderWhatsNext } from "./scoreCard.js";
import type { VisibilityScore } from "../types.js";

function score(overrides: Partial<VisibilityScore> = {}): VisibilityScore {
  return {
    id: "1",
    business_id: "b1",
    score: 72,
    categoryBreakdown: { reviews: 40, listings: 90 },
    recommendations: ["Respond to outstanding reviews."],
    computed_at: "2026-01-01T00:00:00Z",
    previousScore: 65,
    trend: 7,
    topDrivers: [
      { category: "reviews", score: 40, direction: "negative" },
      { category: "listings", score: 90, direction: "positive" },
    ],
    nextBestFix: "Respond to outstanding reviews.",
    dataConfidence: { reviews: "verified", listings: "verified" },
    vertical: "general",
    industryInsight: null,
    ...overrides,
  };
}

describe("classifyChatIntent", () => {
  it("recognizes show_score phrasing", () => {
    expect(classifyChatIntent("Show this week's visibility score")).toBe("show_score");
    expect(classifyChatIntent("how am I doing?")).toBe("show_score");
  });

  it("recognizes whats_next phrasing", () => {
    expect(classifyChatIntent("What should I fix first?")).toBe("whats_next");
    expect(classifyChatIntent("what's next")).toBe("whats_next");
  });

  it("falls through to null for unrelated text", () => {
    expect(classifyChatIntent("YES")).toBeNull();
    expect(classifyChatIntent("BOOST YES $50")).toBeNull();
    expect(classifyChatIntent("EDIT make it shorter")).toBeNull();
  });
});

describe("renderScoreCard", () => {
  it("includes score, trend, and top driver", () => {
    const card = renderScoreCard(score());
    expect(card).toContain("72/100");
    expect(card).toContain("+7");
    expect(card).toContain("reviews");
  });
});

describe("renderWhatsNext", () => {
  it("includes the next best fix and a point-impact estimate", () => {
    const text = renderWhatsNext(score());
    expect(text).toContain("Respond to outstanding reviews.");
    expect(text).toContain("points");
  });

  it("handles no next-best-fix gracefully", () => {
    const text = renderWhatsNext(score({ nextBestFix: null }));
    expect(text).not.toContain("undefined");
  });
});
