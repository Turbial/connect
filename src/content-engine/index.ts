import { supabase } from "../lib/supabase.js";
import { generatePost } from "./generate.js";
import type { Business, Platform } from "../types.js";

export function connectedPlatforms(business: Business): Platform[] {
  const platforms: Platform[] = ["gbp"]; // GBP is always assumed connected in Phase 1+
  if (business.fb_page_id) platforms.push("facebook");
  if (business.ig_business_id) platforms.push("instagram");
  return platforms;
}

/**
 * Generates Phase 1's weekly batch (2-4 ideas) and queues one content_item per
 * connected platform per idea, with platform-tailored copy (Phase 2).
 */
export async function queueWeeklyContent(business: Business, count = 3): Promise<void> {
  const platforms = connectedPlatforms(business);

  for (let i = 0; i < count; i++) {
    for (const platform of platforms) {
      const { caption, mediaUrl } = await generatePost(business, platform);

      const { error } = await supabase.from("content_item").insert({
        business_id: business.id,
        source: "content_engine",
        caption,
        media_url: mediaUrl,
        platforms: [platform],
        status: "queued",
      });

      if (error) throw error;
    }
  }
}

/** Phase 4: generates a single draft from a review and queues it across connected platforms. */
export async function queueReviewTriggeredContent(business: Business, reviewId: string, brief: string): Promise<void> {
  const platforms = connectedPlatforms(business);

  for (const platform of platforms) {
    const { caption, mediaUrl } = await generatePost(business, platform, brief);

    const { error } = await supabase.from("content_item").insert({
      business_id: business.id,
      source: "review_triggered",
      caption,
      media_url: mediaUrl,
      platforms: [platform],
      status: "queued",
      review_id: reviewId,
    });

    if (error) throw error;
  }
}
