import type { Platform, Vertical } from "../types.js";

/** Phase 8.4 (doc §12): which `stub`/`sandbox` platforms get prioritized for
 * verification work, by vertical — a planning artifact, not new adapter
 * code. Doc §12's "do not chase logos": platform-expansion effort should
 * point at this list, not engineering convenience. `general` has no named
 * priority list — there's no vertical-specific platform mix to prioritize
 * for a business with no named vertical. */
export const VERTICAL_PLATFORM_PRIORITY: Record<Vertical, Platform[]> = {
  home_services: ["gbp", "nextdoor", "angi", "thumbtack", "yelp", "facebook", "instagram", "youtube", "bing"],
  restaurant: ["gbp", "yelp", "opentable", "tripadvisor", "instagram", "tiktok", "facebook"],
  wellness: ["instagram", "tiktok", "gbp", "yelp", "facebook", "youtube"],
  general: [],
};

export function platformPriorityFor(vertical: Vertical | null): Platform[] {
  return VERTICAL_PLATFORM_PRIORITY[vertical ?? "general"];
}
