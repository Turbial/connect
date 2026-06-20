import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeCaptionQualities,
  computeEngagementScore,
  diffAttributes,
  splitTopAndBottom,
  type ContentPerformanceEntry,
} from "./index.js";

function entry(overrides: Partial<ContentPerformanceEntry>): ContentPerformanceEntry {
  return {
    contentItemId: "item-1",
    postId: "post-1",
    platform: "instagram",
    variant: "a",
    mediaType: "image",
    surface: "feed",
    caption: "Check out our weekend special!",
    postedAt: "2026-06-01T15:00:00.000Z",
    views: 100,
    clicks: 0,
    calls: 0,
    engagement: 0,
    impressions: 0,
    shares: 0,
    score: 100,
    ...overrides,
  };
}

describe("computeEngagementScore", () => {
  it("weights actions above passive views", () => {
    const viewsOnly = computeEngagementScore({ views: 200, clicks: 0, calls: 0, engagement: 0, impressions: 0, shares: 0 });
    const fewerViewsManyShares = computeEngagementScore({ views: 100, clicks: 0, calls: 0, engagement: 0, impressions: 0, shares: 50 });
    expect(fewerViewsManyShares).toBeGreaterThan(viewsOnly);
  });

  it("is purely additive across metrics", () => {
    expect(computeEngagementScore({ views: 10, clicks: 1, calls: 1, engagement: 1, impressions: 10, shares: 1 })).toBe(
      10 * 1 + 10 * 0.5 + 1 * 3 + 1 * 4 + 1 * 6 + 1 * 8
    );
  });
});

describe("splitTopAndBottom", () => {
  it("returns the whole list as top when fewer than 2 entries", () => {
    const ranked = [entry({})];
    expect(splitTopAndBottom(ranked)).toEqual({ top: ranked, bottom: [] });
  });

  it("splits a ranked list into non-overlapping top/bottom groups", () => {
    const ranked = Array.from({ length: 10 }, (_, i) => entry({ postId: `post-${i}`, score: 10 - i }));
    const { top, bottom } = splitTopAndBottom(ranked, 0.3);
    expect(top).toHaveLength(3);
    expect(bottom).toHaveLength(3);
    expect(top[0].postId).toBe("post-0");
    expect(bottom[bottom.length - 1].postId).toBe("post-9");
    const topIds = new Set(top.map((e) => e.postId));
    expect(bottom.some((e) => topIds.has(e.postId))).toBe(false);
  });
});

describe("diffAttributes", () => {
  it("flags media type as significant when it clearly differs between groups", () => {
    const top = [
      entry({ postId: "t1", mediaType: "video" }),
      entry({ postId: "t2", mediaType: "video" }),
      entry({ postId: "t3", mediaType: "video" }),
    ];
    const bottom = [
      entry({ postId: "b1", mediaType: "image" }),
      entry({ postId: "b2", mediaType: "image" }),
      entry({ postId: "b3", mediaType: "video" }),
    ];

    const insights = diffAttributes(top, bottom);
    const mediaInsight = insights.find((i) => i.attribute === "media_type");
    expect(mediaInsight?.significant).toBe(true);
    expect(mediaInsight?.topValue).toBe("video");
  });

  it("does not flag an attribute that's identical across both groups", () => {
    const top = [entry({ postId: "t1", platform: "facebook" }), entry({ postId: "t2", platform: "facebook" })];
    const bottom = [entry({ postId: "b1", platform: "facebook" }), entry({ postId: "b2", platform: "facebook" })];

    const insights = diffAttributes(top, bottom);
    const platformInsight = insights.find((i) => i.attribute === "platform");
    expect(platformInsight?.significant).toBe(false);
  });

  it("flags hashtag usage as significant when top performers consistently use them and bottom performers don't", () => {
    const top = [
      entry({ postId: "t1", caption: "Big sale today! #localbiz #deals" }),
      entry({ postId: "t2", caption: "New arrivals! #shopsmall" }),
    ];
    const bottom = [entry({ postId: "b1", caption: "We are open." }), entry({ postId: "b2", caption: "Visit us soon." })];

    const insights = diffAttributes(top, bottom);
    const hashtagInsight = insights.find((i) => i.attribute === "has_hashtags");
    expect(hashtagInsight?.significant).toBe(true);
    expect(hashtagInsight?.topValue).toBe("true");
  });

  it("returns an empty array when there are no top performers", () => {
    expect(diffAttributes([], [entry({})])).toEqual([]);
  });
});

describe("analyzeCaptionQualities", () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.DEEPSEEK_API_KEY = originalKey;
  });

  it("returns no insights when no DeepSeek key is configured", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const result = await analyzeCaptionQualities([entry({})], [entry({})]);
    expect(result).toEqual([]);
  });

  it("returns no insights when either group has no usable captions", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const result = await analyzeCaptionQualities([entry({ caption: "" })], [entry({})]);
    expect(result).toEqual([]);
  });

  it("maps a successful DeepSeek response into PerformanceInsight-shaped entries", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { pattern: "Question-style hooks", explanation: "Top performers open with a question." },
                ]),
              },
            },
          ],
        }),
      })
    );

    const result = await analyzeCaptionQualities(
      [entry({ caption: "Ever wonder why our pizza sells out by noon?" })],
      [entry({ caption: "We have pizza." })]
    );

    expect(result).toEqual([
      {
        attribute: "caption_quality",
        topValue: "Question-style hooks",
        topShare: 1,
        bottomShare: 0,
        significant: true,
        summary: "Question-style hooks: Top performers open with a question.",
      },
    ]);
  });

  it("handles a response wrapped in a markdown code fence", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "```json\n[{\"pattern\": \"Urgency\", \"explanation\": \"Limited-time framing.\"}]\n```" } }],
        }),
      })
    );

    const result = await analyzeCaptionQualities([entry({ caption: "Last chance today!" })], [entry({ caption: "Open now." })]);
    expect(result).toHaveLength(1);
    expect(result[0].topValue).toBe("Urgency");
  });

  it("degrades to no insights instead of throwing when DeepSeek errors", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await analyzeCaptionQualities([entry({ caption: "A" })], [entry({ caption: "B" })]);
    expect(result).toEqual([]);
  });

  it("degrades to no insights instead of throwing on unparseable output", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
      })
    );

    const result = await analyzeCaptionQualities([entry({ caption: "A" })], [entry({ caption: "B" })]);
    expect(result).toEqual([]);
  });
});
