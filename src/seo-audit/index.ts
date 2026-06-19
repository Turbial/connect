import { supabase } from "../lib/supabase.js";
import type { Business } from "../types.js";

/**
 * Local SEO / citation completeness audit. Checks the business's own NAP
 * (Name/Address/Phone) record for the gaps that most commonly hurt local
 * search ranking, rather than crawling every connected platform's live
 * listing — each platform's profile-read API would need its own
 * confirmation, same caveat as the posting adapters in src/distribution.
 */
function auditIssues(business: Business): string[] {
  const issues: string[] = [];
  if (!business.phone) issues.push("Missing primary phone number");
  if (!business.location) issues.push("Missing business address");
  if (!business.location_lat || !business.location_lng) issues.push("Missing geocoded coordinates for address");
  if (!business.gbp_location_id) issues.push("Not connected to Google Business Profile");
  if (!business.owner_email && !business.owner_phone) issues.push("No owner contact method on file for approvals");
  if (!business.fb_page_id) issues.push("Not connected to Facebook Page");
  if (!business.ig_business_id) issues.push("Not connected to Instagram Business");
  if (!business.preferred_language) issues.push("No preferred language set for translated copy");
  if (!business.meta_ads_account_id && !business.google_ads_customer_id) issues.push("No ad account connected for boost campaigns");
  if (!business.yelp_business_id) issues.push("Not connected to Yelp");
  if (!business.gbp_refresh_token) issues.push("Missing GBP refresh token (re-auth required for long-lived access)");
  return issues;
}

function scoreFromIssues(issueCount: number): number {
  return Math.max(0, 100 - issueCount * 10);
}

/** Runs a citation/NAP completeness audit for a business and stores the result. */
export async function runSeoAudit(business: Business): Promise<{ score: number; issues: string[] }> {
  const issues = auditIssues(business);
  const score = scoreFromIssues(issues.length);

  const { error } = await supabase.from("seo_audit").insert({
    business_id: business.id,
    score,
    issues,
  });
  if (error) throw error;

  return { score, issues };
}
