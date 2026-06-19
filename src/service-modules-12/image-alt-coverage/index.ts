import { supabase } from "../../lib/supabase.js";
import { captureSignal } from "../shared.js";
import type { Business, ContentItem } from "../../types.js";

/** Captures the share of the business's content items with media that also
 * have alt text set, as an accessibility-coverage signal. */
export async function runImageAltCoverageSignal(business: Business): Promise<void> {
  const { data: items, error } = await supabase.from("content_item").select("*").eq("business_id", business.id);
  if (error) throw error;

  const withMedia = ((items ?? []) as (ContentItem & { alt_text?: string | null })[]).filter((i) => i.media_url);
  if (withMedia.length === 0) {
    await captureSignal(business.id, "image-alt-coverage", "alt_text_coverage", "0");
    return;
  }

  const withAlt = withMedia.filter((i) => i.alt_text).length;
  const coverage = withAlt / withMedia.length;
  await captureSignal(business.id, "image-alt-coverage", "alt_text_coverage", coverage.toFixed(2));
}
