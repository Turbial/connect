import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { queueWeeklyContent } from "../content-engine/index.js";
import { requestApproval, applyTimeouts, getEditQueue, draftEditRewrite, proposeEditRewrite } from "../approval/index.js";
import { postApprovedContent } from "../distribution/index.js";
import { sendWeeklyReport } from "../reporting/index.js";
import { isOwnerVerified } from "../lib/ownerVerification.js";
import { hasFeature } from "../lib/packages.js";
import { classifyEditReply, recordBrandMemory } from "../lib/brandMemory.js";
import type { Business, ContentItem } from "../types.js";

const TIMEOUT_HOURS = Number(process.env.APPROVAL_TIMEOUT_HOURS ?? 48);

async function runForBusiness(business: Business): Promise<void> {
  if (!isOwnerVerified(business)) {
    console.log(`Skipping business ${business.id}: owner phone not yet verified.`);
    return;
  }

  if (!hasFeature(business, "content_generation")) {
    console.log(`Skipping business ${business.id}: package tier does not include content generation.`);
    return;
  }

  await queueWeeklyContent(business);

  const { data: queued, error } = await supabase
    .from("content_item")
    .select("*")
    .eq("business_id", business.id)
    .eq("status", "queued");
  if (error) throw error;

  if (business.autopilot_enabled) {
    // Autopilot: mark all queued items approved and post without waiting
    // for the owner's SMS/email reply.
    const ids = (queued ?? []).map((item) => (item as ContentItem).id);
    if (ids.length > 0) {
      await supabase.from("content_item").update({ status: "approved" }).in("id", ids);
      await postApprovedContent(business);
    }
  } else {
    await requestApproval(business, (queued ?? []) as ContentItem[]);
  }
}

async function main(): Promise<void> {
  const { data: businesses, error } = await supabase.from("business").select("*");
  if (error) throw error;

  for (const business of (businesses ?? []) as Business[]) {
    try {
      await runForBusiness(business);
    } catch (err) {
      console.error(`weeklyBatch content queueing failed for business ${business.id}:`, err);
    }
  }

  // Resolve any prior week's requests that timed out before this week's batch goes out.
  await applyTimeouts(TIMEOUT_HOURS);

  for (const business of (businesses ?? []) as Business[]) {
    if (!isOwnerVerified(business)) continue;
    try {
      if (hasFeature(business, "auto_posting")) {
        await postApprovedContent(business);
      }
      await sendWeeklyReport(business);
    } catch (err) {
      console.error(`weeklyBatch posting/report failed for business ${business.id}:`, err);
    }
  }

  // Surface pending EDIT requests so they're a visible queue, not a silent
  // dead end in the database. Phase 3.3: in addition to logging, draft an
  // agent rewrite per item and send it back to the owner for a YES/NO.
  const editQueue = await getEditQueue();
  if (editQueue.length > 0) {
    console.log(`${editQueue.length} content item(s) awaiting EDIT resolution:`, editQueue);

    const businessById = new Map((businesses ?? []).map((b) => [b.id, b as Business]));
    for (const item of editQueue) {
      // Phase 7.3: classify why the owner asked for the change before
      // drafting the rewrite, so a category like "rejected_phrase" persists
      // as creative memory even if the rewrite itself is never approved.
      if (item.requestedChange) {
        const classified = await classifyEditReply(item.requestedChange);
        if (classified) await recordBrandMemory(item.businessId, classified);
      }

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
