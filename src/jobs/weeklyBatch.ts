import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { queueWeeklyContent } from "../content-engine/index.js";
import { requestApproval, applyTimeouts } from "../approval/index.js";
import { postApprovedContent } from "../distribution/index.js";
import { sendWeeklyReport } from "../reporting/index.js";
import type { Business, ContentItem } from "../types.js";

const TIMEOUT_HOURS = Number(process.env.APPROVAL_TIMEOUT_HOURS ?? 48);

async function runForBusiness(business: Business): Promise<void> {
  await queueWeeklyContent(business);

  const { data: queued, error } = await supabase
    .from("content_item")
    .select("*")
    .eq("business_id", business.id)
    .eq("status", "queued");
  if (error) throw error;

  await requestApproval(business, (queued ?? []) as ContentItem[]);
}

async function main(): Promise<void> {
  const { data: businesses, error } = await supabase.from("business").select("*");
  if (error) throw error;

  for (const business of (businesses ?? []) as Business[]) {
    await runForBusiness(business);
  }

  // Resolve any prior week's requests that timed out before this week's batch goes out.
  await applyTimeouts(TIMEOUT_HOURS);

  for (const business of (businesses ?? []) as Business[]) {
    await postApprovedContent(business);
    await sendWeeklyReport(business);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
