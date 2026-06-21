import { supabase } from "../../lib/supabase.js";
import { captureSignal } from "../shared.js";
import type { Business, ContentItem } from "../../types.js";

/** Captures the number of days since the business's most recent posted
 * content item, as a content-freshness signal. */
export async function runContentFreshnessSignal(business: Business): Promise<void> {
  const { data: items, error } = await supabase
    .from("content_item")
    .select("*")
    .eq("business_id", business.id)
    .eq("status", "posted")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;

  const latest = (items ?? [])[0] as ContentItem | undefined;
  const daysSince = latest ? Math.floor((Date.now() - new Date(latest.created_at).getTime()) / (24 * 60 * 60 * 1000)) : null;
  await captureSignal(business.id, "content-freshness", "days_since_last_post", daysSince === null ? null : String(daysSince));
}
