import { describe, expect, it } from "vitest";
import { buildBoostReportEntry } from "./boostReport.js";
import type { BoostTrigger, LeadEvent, Post } from "../types.js";

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    content_item_id: "item-1",
    platform: "facebook",
    platform_post_id: "p1",
    posted_at: new Date().toISOString(),
    views: 100,
    clicks: 20,
    calls: 0,
    engagement: 15,
    impressions: 0,
    shares: 0,
    last_polled_at: new Date().toISOString(),
    variant: "a",
    ...overrides,
  };
}

function makeTrigger(overrides: Partial<BoostTrigger> = {}): BoostTrigger {
  return {
    id: "trigger-1",
    post_id: "post-1",
    threshold_met_at: new Date().toISOString(),
    owner_response: "yes",
    responded_at: new Date().toISOString(),
    handed_off_to_marketing: true,
    ad_platform: "meta",
    ad_campaign_id: "camp-1",
    budget_cents: 2500,
    ...overrides,
  };
}

describe("buildBoostReportEntry", () => {
  it("reports spend/clicks/engagement with no leads line when no lead_event exists", () => {
    const entry = buildBoostReportEntry(makePost(), makeTrigger(), []);
    expect(entry).toEqual({
      platform: "facebook",
      spentCents: 2500,
      clicks: 20,
      engagement: 15,
      leadCount: null,
      attributedRevenueCents: null,
    });
  });

  it("includes real attributed leads/revenue when a lead_event ties back to the post", () => {
    const leadEvents: LeadEvent[] = [
      { id: "l1", business_id: "b1", content_item_id: null, post_id: "post-1", platform: "facebook", source: "form", external_ref: null, amount_cents: 5000, occurred_at: new Date().toISOString() },
      { id: "l2", business_id: "b1", content_item_id: null, post_id: "post-1", platform: "facebook", source: "call", external_ref: null, amount_cents: null, occurred_at: new Date().toISOString() },
    ];
    const entry = buildBoostReportEntry(makePost(), makeTrigger(), leadEvents);
    expect(entry.leadCount).toBe(2);
    expect(entry.attributedRevenueCents).toBe(5000);
  });

  it("never fabricates spend for a boost with no budget recorded", () => {
    const entry = buildBoostReportEntry(makePost(), makeTrigger({ budget_cents: null }), []);
    expect(entry.spentCents).toBe(0);
  });
});
