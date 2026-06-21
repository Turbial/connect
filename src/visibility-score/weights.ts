import type { Vertical } from "../types.js";

/** Phase 6.3: relative weight per score category — not required to sum to
 * any fixed total, since the overall score is a weighted average
 * (sum(score*weight) / sum(weight)), so adding/removing a category never
 * needs every other weight rebalanced. */
export type WeightTable = Record<string, number>;

const EQUAL_WEIGHTS: WeightTable = {
  listings: 1,
  reviews: 1,
  "website health": 1,
  "search presence": 1,
  "social activity": 1,
  "content freshness": 1,
  "competitor strength": 1,
  "ads readiness": 1,
  "response rate": 1,
  "profile completeness": 1,
};

/** Home services per doc §9.1/§9.2: the named platforms (GBP Local Posts,
 * Nextdoor, Angi, Thumbtack, Yelp) and trust signals (reviews, response
 * rate) are the highest-leverage levers for this vertical, so they're
 * weighted above the equal-weight baseline; social activity matters less
 * than for a visually-driven vertical. */
const HOME_SERVICES_WEIGHTS: WeightTable = {
  listings: 1.5,
  reviews: 1.5,
  "website health": 0.8,
  "search presence": 1.5,
  "social activity": 0.7,
  "content freshness": 0.8,
  "competitor strength": 1,
  "ads readiness": 0.8,
  "response rate": 1.2,
  "profile completeness": 1,
};

/** Restaurant per doc §4/§9.2: review sentiment and the named listing
 * platforms (GBP/Yelp/OpenTable) are the highest-leverage levers, with
 * Instagram/TikTok and food-photo freshness close behind — a visually-driven
 * vertical, unlike home services. */
const RESTAURANT_WEIGHTS: WeightTable = {
  listings: 1.4,
  reviews: 1.6,
  "website health": 0.8,
  "search presence": 1.3,
  "social activity": 1.5,
  "content freshness": 1.3,
  "competitor strength": 1,
  "ads readiness": 0.9,
  "response rate": 1,
  "profile completeness": 1.2,
};

/** Wellness (med spa/salon/clinic/gym) per doc §4/§9.3: Instagram/TikTok
 * presence and trust signals (reviews, credentials, before/after content)
 * are the highest-leverage levers — even more social-weighted than
 * restaurants, since the doc calls Instagram/TikTok "very high" here. */
const WELLNESS_WEIGHTS: WeightTable = {
  listings: 1.2,
  reviews: 1.4,
  "website health": 0.9,
  "search presence": 1.3,
  "social activity": 1.6,
  "content freshness": 1.4,
  "competitor strength": 1,
  "ads readiness": 0.9,
  "response rate": 1.1,
  "profile completeness": 1.1,
};

const WEIGHT_TABLES: Record<Vertical, WeightTable> = {
  home_services: HOME_SERVICES_WEIGHTS,
  restaurant: RESTAURANT_WEIGHTS,
  wellness: WELLNESS_WEIGHTS,
  general: EQUAL_WEIGHTS,
};

export function weightTableFor(vertical: Vertical | null): WeightTable {
  return WEIGHT_TABLES[vertical ?? "general"];
}

/** Weighted mean of a category breakdown — falls back to an unweighted mean
 * for any category missing from the table (defensive only; every named
 * category in computeCategories has an entry in every table above). */
export function weightedScore(categoryBreakdown: Record<string, number>, weights: WeightTable): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const [category, score] of Object.entries(categoryBreakdown)) {
    const weight = weights[category] ?? 1;
    weightedSum += score * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : Math.round(weightedSum / weightSum);
}

/** Vertical-specific framing for the audit report — content-angle language
 * from doc §9.1/§9.2/§9.3. `general` stays null rather than inventing a
 * per-vertical claim this phase doesn't back with tuned weights. */
export function industryInsightFor(vertical: Vertical | null): string | null {
  switch (vertical ?? "general") {
    case "home_services":
      return "For home services, your local listing accuracy and review velocity matter most — Nextdoor, Angi, and Thumbtack visibility drive jobs more than social reach does.";
    case "restaurant":
      return "For restaurants, review sentiment and your GBP/Yelp/OpenTable presence matter most — fresh food photos and Instagram/TikTok engagement drive foot traffic more than generic social reach does.";
    case "wellness":
      return "For health, beauty, and wellness, Instagram/TikTok presence and trust signals matter most — reviews, before/after content, and booking conversion drive new clients more than generic social reach does.";
    case "general":
    default:
      return null;
  }
}
