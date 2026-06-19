import { describe, expect, it } from "vitest";
import { canAutoBoost } from "./boostPolicy.js";
import type { Business, Post } from "../types.js";

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    auto_boost_threshold_cents: null,
    boost_allowed_platforms: null,
    manual_approval_threshold_cents: null,
    max_boost_per_post_cents: null,
    max_daily_boost_spend_cents: null,
    max_weekly_boost_spend_cents: null,
    boost_stop_loss_cents: null,
    boost_budget_reset_schedule: null,
    ...overrides,
  } as Business;
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    content_item_id: "item-1",
    platform: "facebook",
    platform_post_id: "p1",
    posted_at: new Date().toISOString(),
    views: 100,
    clicks: 0,
    calls: 0,
    engagement: 10,
    impressions: 0,
    shares: 0,
    last_polled_at: new Date().toISOString(),
    variant: "a",
    ...overrides,
  };
}

describe("canAutoBoost", () => {
  it("never auto-boosts when no policy is configured", async () => {
    const decision = await canAutoBoost(makeBusiness(), makePost(), 2000);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/no auto-boost policy/);
  });

  it("never auto-boosts a non-verified-tier platform's post", async () => {
    const business = makeBusiness({ auto_boost_threshold_cents: 5000 });
    const decision = await canAutoBoost(business, makePost({ platform: "gbp" }), 2000);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/not a verified platform/);
  });

  it("never auto-boosts a platform excluded from boost_allowed_platforms", async () => {
    const business = makeBusiness({ auto_boost_threshold_cents: 5000, boost_allowed_platforms: ["instagram"] });
    const decision = await canAutoBoost(business, makePost({ platform: "facebook" }), 2000);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/boost_allowed_platforms/);
  });

  it("requires the proposed budget to stay under auto_boost_threshold_cents", async () => {
    const business = makeBusiness({ auto_boost_threshold_cents: 1000 });
    const decision = await canAutoBoost(business, makePost(), 2000);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/auto_boost_threshold_cents/);
  });

  it("requires the proposed budget to stay under manual_approval_threshold_cents even when below the auto-boost threshold", async () => {
    const business = makeBusiness({ auto_boost_threshold_cents: 5000, manual_approval_threshold_cents: 1000 });
    const decision = await canAutoBoost(business, makePost(), 2000);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/manual_approval_threshold_cents/);
  });

  it("requires the proposed budget to stay under max_boost_per_post_cents", async () => {
    const business = makeBusiness({ auto_boost_threshold_cents: 5000, max_boost_per_post_cents: 1000 });
    const decision = await canAutoBoost(business, makePost(), 2000);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/max_boost_per_post_cents/);
  });
});
