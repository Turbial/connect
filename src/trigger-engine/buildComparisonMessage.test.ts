import { describe, it, expect } from "vitest";
import { buildComparisonMessage } from "./index.js";
import type { Post } from "../types.js";

function makePost(overrides: Partial<Post>): Post {
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

describe("buildComparisonMessage", () => {
  it("cites version B as the winner when it has more engagement", () => {
    const postA = makePost({ engagement: 10, variant: "a" });
    const postB = makePost({ id: "post-2", engagement: 14, variant: "b" });
    const message = buildComparisonMessage(postA, postB, "Caption A", "Caption B");
    expect(message).toContain("Version B got 40% more engagement");
    expect(message).toContain("Caption B");
  });

  it("cites version A as the winner when it has more engagement", () => {
    const postA = makePost({ engagement: 20, variant: "a" });
    const postB = makePost({ id: "post-2", engagement: 10, variant: "b" });
    const message = buildComparisonMessage(postA, postB, "Caption A", "Caption B");
    expect(message).toContain("Version A got 100% more engagement");
    expect(message).toContain("Caption A");
  });

  it("never fabricates a percentage when the loser had zero engagement", () => {
    const postA = makePost({ engagement: 0, variant: "a" });
    const postB = makePost({ id: "post-2", engagement: 5, variant: "b" });
    const message = buildComparisonMessage(postA, postB, "Caption A", "Caption B");
    expect(message).toContain("Version B got 100% more engagement");
  });
});
