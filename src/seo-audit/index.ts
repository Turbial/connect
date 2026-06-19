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
  return issues;
}

function scoreFromIssues(issueCount: number): number {
  return Math.max(0, 100 - issueCount * 20);
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
