import { describe, expect, it } from "vitest";
import {
  scoreFromAdsReadiness,
  scoreFromCompetitorMonitor,
  scoreFromDuplicateListings,
  scoreFromListingSync,
  scoreFromRankTracker,
  scoreFromSeoAudit,
  scoreFromSentimentTracker,
} from "./index.js";
import type { Business } from "../types.js";

describe("scoreFromSeoAudit", () => {
  it("uses the stored score as-is, defaulting to 50 when absent", () => {
    expect(scoreFromSeoAudit(80)).toBe(80);
    expect(scoreFromSeoAudit(null)).toBe(50);
  });
});

describe("scoreFromDuplicateListings", () => {
  it("decays 25 points per flagged duplicate, floored at 0", () => {
    expect(scoreFromDuplicateListings(0)).toBe(100);
    expect(scoreFromDuplicateListings(2)).toBe(50);
    expect(scoreFromDuplicateListings(10)).toBe(0);
  });
});

describe("scoreFromRankTracker", () => {
  it("scores rank 1 as 100 and decays for worse ranks, 0 when unranked", () => {
    expect(scoreFromRankTracker(1)).toBe(100);
    expect(scoreFromRankTracker(11)).toBe(0);
    expect(scoreFromRankTracker(null)).toBe(0);
  });
});

describe("scoreFromSentimentTracker", () => {
  it("maps a 1-5 rating onto 0-100, defaulting to 50 when absent", () => {
    expect(scoreFromSentimentTracker(5)).toBe(100);
    expect(scoreFromSentimentTracker(1)).toBe(0);
    expect(scoreFromSentimentTracker(null)).toBe(50);
  });
});

describe("scoreFromCompetitorMonitor", () => {
  it("scores 50 when there is nothing to compare", () => {
    expect(scoreFromCompetitorMonitor(null, [4, 4.5])).toBe(50);
    expect(scoreFromCompetitorMonitor(4, [])).toBe(50);
  });

  it("scores lower the more competitors outperform the business", () => {
    expect(scoreFromCompetitorMonitor(4, [3, 3.5])).toBe(100);
    expect(scoreFromCompetitorMonitor(4, [4.5, 4.8])).toBe(0);
  });
});

describe("scoreFromListingSync", () => {
  it("scores success as 100, failure as 0, unknown as 50", () => {
    expect(scoreFromListingSync("success")).toBe(100);
    expect(scoreFromListingSync("failed")).toBe(0);
    expect(scoreFromListingSync(null)).toBe(50);
  });
});

describe("scoreFromAdsReadiness", () => {
  it("scores 100 when either ad account is connected, 0 otherwise", () => {
    const connected = { meta_ads_account_id: "abc", google_ads_customer_id: null } as Business;
    const notConnected = { meta_ads_account_id: null, google_ads_customer_id: null } as Business;
    expect(scoreFromAdsReadiness(connected)).toBe(100);
    expect(scoreFromAdsReadiness(notConnected)).toBe(0);
  });
});
