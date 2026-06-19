import type { Business, GeneratedPost, MediaType, Platform } from "../types.js";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const FAL_IMAGE_URL = "https://fal.run/fal-ai/flux/schnell";
const FAL_VIDEO_URL = "https://fal.run/fal-ai/kling-video/v1/standard/text-to-video";

const PLATFORM_BRIEF: Record<Platform, string> = {
  gbp: "a short, local Google Business Profile post (under 1500 characters, no hashtags). Highlight a seasonal offer or recent work, written like a local update, not an ad.",
  instagram: "a short, punchy Instagram caption (under 200 characters) built around a single strong visual moment, with 3-5 relevant hashtags at the end.",
  facebook: "a longer, conversational Facebook post (300-600 characters) that tells a brief story about the business or a customer, no hashtags needed.",
  pinterest: "a short, keyword-rich Pinterest pin description (under 500 characters) that reads like a helpful idea or inspiration, with 2-3 relevant hashtags.",
  twitter: "a short, punchy post for X (under 280 characters), conversational and direct, 1-2 hashtags at most.",
  linkedin: "a professional but approachable LinkedIn post (200-400 characters) framed around expertise, craftsmanship, or community impact, no hashtags needed.",
  threads: "a short, casual, conversational post for Threads (under 280 characters), more personal and off-the-cuff than a polished ad.",
  yelp: "a short business update (under 300 characters) for a Yelp business page, factual and helpful (hours, new offerings, announcements), no salesy language.",
  nextdoor: "a short, neighborly post (under 300 characters) for Nextdoor framed as a local update or community contribution, not an ad — Nextdoor users are sensitive to overt marketing.",
  snapchat: "a very short, casual caption (under 80 characters) to accompany a Snapchat Spotlight/Story image, fun and informal tone.",
  tiktok: "a short, energetic caption (under 150 characters) for a TikTok video, hook-driven, with 2-4 trending-style hashtags.",
  youtube: "a short, descriptive caption/title (under 100 characters) for a YouTube Short, clear about what the viewer will see, no clickbait.",
  whatsapp: "a short, direct broadcast-style update (under 200 characters) for a WhatsApp Business customer list, friendly and personal, no hashtags.",
  reddit: "a short, genuine post title plus body (under 500 characters total) for a relevant subreddit, written like a real community member sharing something useful, not an ad — Reddit users are highly sensitive to overt marketing.",
  bluesky: "a short, casual post (under 300 characters) for Bluesky, conversational and direct, similar in tone to X but without the hashtag-heavy style.",
  mastodon: "a short, conversational post (under 500 characters) for Mastodon, written for a niche, community-minded audience, with 1-2 relevant hashtags.",
  tumblr: "a short, expressive post (under 250 characters) for Tumblr, casual and a little playful, 3-5 relevant tags at the end.",
  wechat: "a short business update (under 200 characters) for a WeChat Official Account post, factual and respectful in tone, no hashtags.",
};

/** Platforms that require a video asset rather than a static image. */
const VIDEO_PLATFORMS = new Set<Platform>(["tiktok", "youtube"]);

/** Platforms whose brief calls for hashtags, where SEO-optimized hashtag generation adds value. */
const HASHTAG_PLATFORMS = new Set<Platform>(["instagram", "pinterest", "twitter", "tiktok", "mastodon", "tumblr"]);

/** Maps a review's star rating to a tone descriptor for sentiment-aware review-triggered
 * copy. Reviews below MIN_RATING_FOR_CONTENT (4) never reach here in practice, but this
 * stays conservative for any rating outside the expected positive range. */
function sentimentTone(reviewRating?: number | null): string | null {
  if (reviewRating == null) return null;
  if (reviewRating >= 5) return "warm, genuinely thrilled, and grateful";
  if (reviewRating >= 4) return "appreciative and upbeat";
  return "matter-of-fact and measured";
}

async function callDeepSeek(prompt: string): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek request failed: ${res.status}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content.trim();
}

async function generateCaption(
  business: Business,
  platform: Platform,
  context?: string,
  reviewRating?: number | null
): Promise<string> {
  const contextLine = context ? ` Base it on this: ${context}.` : "";
  const tone = sentimentTone(reviewRating);
  const toneLine = tone ? ` Write in a tone that's ${tone}, reflecting the sentiment of the feedback it's based on.` : "";

  const result = await callDeepSeek(
    `Write ${PLATFORM_BRIEF[platform]} for ${business.name}, located in ${business.location ?? "the local area"}.${contextLine}${toneLine} Keep it specific and concrete, not generic marketing copy.`
  );
  return result ?? `Check out what's new at ${business.name} this week!`;
}

/** Generates SEO-optimized, platform-appropriate hashtags for platforms whose
 * brief calls for them, as a separate pass from caption generation so hashtag
 * quality doesn't depend on the main copy prompt staying within length limits. */
async function generateHashtags(business: Business, caption: string, platform: Platform): Promise<string[]> {
  const result = await callDeepSeek(
    `Generate 3-5 SEO-optimized, ${platform}-appropriate hashtags for this post from ${business.name} in ${business.location ?? "the local area"}: "${caption}". Respond with only the hashtags, each starting with #, separated by spaces. No explanation.`
  );
  if (!result) return [];
  return result.split(/\s+/).filter((token) => token.startsWith("#"));
}

/** Translates a generated caption into the business's preferred language, preserving
 * tone and any existing hashtags. Used when business.preferred_language is set to
 * something other than English. */
async function translateCaption(caption: string, language: string): Promise<string> {
  const result = await callDeepSeek(
    `Translate the following social media post into ${language}, preserving its tone and keeping any hashtags as-is: "${caption}"`
  );
  return result ?? caption;
}

async function generateImage(business: Business, caption: string): Promise<string | null> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) return null;

  // GBP photos are roughly square; IG/FB Distribution Service crops per-platform at post time,
  // so the Content Engine generates one square_hd source image and lets each platform adapter
  // handle its own aspect ratio rather than generating separate images per platform.
  const res = await fetch(FAL_IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: `Photo-realistic image representing: ${caption}. Business: ${business.name}.`,
      image_size: "square_hd",
    }),
  });

  if (!res.ok) {
    throw new Error(`fal.ai image request failed: ${res.status}`);
  }

  const data = (await res.json()) as { images?: { url: string }[] };
  return data.images?.[0]?.url ?? null;
}

/** Generates a short (5-10s) vertical video clip for TikTok/YouTube Shorts via fal.ai's
 * text-to-video model. Slower and costlier than image generation, so it's only used
 * for platforms that actually require video. */
async function generateVideo(business: Business, caption: string): Promise<string | null> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(FAL_VIDEO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: `Short vertical video representing: ${caption}. Business: ${business.name}.`,
      aspect_ratio: "9:16",
      duration: "5",
    }),
  });

  if (!res.ok) {
    throw new Error(`fal.ai video request failed: ${res.status}`);
  }

  const data = (await res.json()) as { video?: { url: string } };
  return data.video?.url ?? null;
}

export async function generatePost(
  business: Business,
  platform: Platform = "gbp",
  context?: string,
  reviewRating?: number | null
): Promise<GeneratedPost> {
  let caption = await generateCaption(business, platform, context, reviewRating);

  if (business.preferred_language && business.preferred_language.toLowerCase() !== "en") {
    caption = await translateCaption(caption, business.preferred_language);
  }

  if (HASHTAG_PLATFORMS.has(platform)) {
    const hashtags = await generateHashtags(business, caption, platform);
    if (hashtags.length > 0) caption = `${caption}\n\n${hashtags.join(" ")}`;
  }

  const mediaType: MediaType = VIDEO_PLATFORMS.has(platform) ? "video" : "image";
  const mediaUrl = mediaType === "video" ? await generateVideo(business, caption) : await generateImage(business, caption);
  return { caption, mediaUrl, mediaType };
}
