import { supabase } from "../lib/supabase.js";
import { queueWeeklyContent } from "../content-engine/index.js";
import { requestApproval, applyTimeouts } from "../approval/index.js";
import { postApprovedContent } from "../distribution/index.js";
import { sendWeeklyReport } from "../reporting/index.js";
import type { Business, ContentItem } from "../types.js";

const TIMEOUT_HOURS = Number(process.env.APPROVAL_TIMEOUT_HOURS ?? 48);

/** Phase 4.3: bulk publish/report across an org's locations — runs the same
 * per-business weekly flow as src/jobs/weeklyBatch.ts (queueWeeklyContent ->
 * requestApproval -> ... -> postApprovedContent -> sendWeeklyReport), scoped
 * to one organization's businesses instead of every business in the system.
 * Kept as a separate entry point rather than folding into weeklyBatch.ts so
 * an agency can re-run/schedule its own org independently of the global
 * nightly batch. */
export async function runForOrganization(organizationId: string): Promise<void> {
  const { data: businesses, error } = await supabase.from("business").select("*").eq("organization_id", organizationId);
  if (error) throw error;
  const orgBusinesses = (businesses ?? []) as Business[];

  for (const business of orgBusinesses) {
    await queueWeeklyContent(business);

    const { data: queued, error: queuedError } = await supabase
      .from("content_item")
      .select("*")
      .eq("business_id", business.id)
      .eq("status", "queued");
    if (queuedError) throw queuedError;

    await requestApproval(business, (queued ?? []) as ContentItem[]);
  }

  // Resolve any prior week's requests that timed out before this batch goes out.
  await applyTimeouts(TIMEOUT_HOURS);

  for (const business of orgBusinesses) {
    await postApprovedContent(business);
    await sendWeeklyReport(business);
  }
}
