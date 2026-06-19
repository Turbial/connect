import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { queueWeeklyContent } from "../content-engine/index.js";
import { requestApproval, applyTimeouts, getEditQueue, draftEditRewrite, proposeEditRewrite } from "../approval/index.js";
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

  // Surface pending EDIT requests so they're a visible queue, not a silent
  // dead end in the database. Phase 3.3: in addition to logging, draft an
  // agent rewrite per item and send it back to the owner for a YES/NO.
  const editQueue = await getEditQueue();
  if (editQueue.length > 0) {
    console.log(`${editQueue.length} content item(s) awaiting EDIT resolution:`, editQueue);

    const businessById = new Map((businesses ?? []).map((b) => [b.id, b as Business]));
    for (const item of editQueue) {
      const rewrite = await draftEditRewrite(item);
      const business = businessById.get(item.businessId);
      if (rewrite && business) {
        await proposeEditRewrite(business, item, rewrite);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
