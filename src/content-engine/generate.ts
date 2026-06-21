import { getOrganizationForBusiness } from "../lib/orgSettings.js";
import { getBrandMemory } from "../lib/brandMemory.js";
import { getStyleNudge } from "../content-analytics/index.js";
import type { Business, BrandMemory, GeneratedPost, MediaType, Platform, Surface } from "../types.js";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const FAL_IMAGE_URL = "https://fal.run/fal-ai/flux/schnell";
const FAL_VIDEO_URL = "https://fal.run/fal-ai/kling-video/v1/standard/text-to-video";

const PLATFORM_BRIEF: Partial<Record<Platform, string>> = {
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
  telegram: "a short, direct broadcast post (under 300 characters) for a Telegram channel, informative and to the point, no hashtags.",
  discord: "a short, casual announcement (under 300 characters) for a Discord community channel, friendly and informal, no hashtags.",
  medium: "a short-form article opener (under 600 characters) for Medium, reflective and a little narrative, no hashtags in the body.",
  vk: "a short, friendly post (under 300 characters) for VK, conversational, 2-3 relevant hashtags.",
  line: "a short, warm broadcast message (under 200 characters) for a LINE Official Account, personal and direct, no hashtags.",
  vimeo: "a short, descriptive caption (under 150 characters) for a Vimeo video upload, clear and professional, no hashtags.",
  flickr: "a short, evocative photo caption (under 200 characters) for Flickr, descriptive of the image, 3-5 relevant tags.",
  foursquare: "a short tip (under 200 characters) for a Foursquare venue page, helpful and specific, no hashtags.",
  bing: "a short business update (under 300 characters) for a Bing Places listing, factual and clear, no hashtags.",
  applebusiness: "a short showcase update (under 250 characters) for an Apple Business Connect listing, polished and concise, no hashtags.",
  houzz: "a short project highlight (under 300 characters) for Houzz, craftsmanship-focused, no hashtags.",
  angi: "a short, trustworthy update (under 300 characters) for an Angi business profile, focused on reliability and quality of work, no hashtags.",
  thumbtack: "a short, professional update (under 300 characters) for a Thumbtack profile, emphasizing responsiveness and expertise, no hashtags.",
  tripadvisor: "a short management update (under 300 characters) for a Tripadvisor listing, welcoming and specific, no hashtags.",
  opentable: "a short update (under 250 characters) for an OpenTable restaurant profile, inviting and specific about the dining experience, no hashtags.",
  quora: "a short, helpful answer-style post (under 400 characters) for a Quora Space, genuinely informative, no hashtags.",
  trustpilot: "a short, gracious public response (under 300 characters) for a Trustpilot business profile, appreciative and professional, no hashtags.",
  yandex: "a short business update (under 300 characters) for a Yandex Business listing, factual and clear, no hashtags.",
};

/** Phase 12 adds 72 new platforms with no distinct copy needs identified yet,
 * so rather than write 72 near-duplicate PLATFORM_BRIEF entries, lookups for
 * any platform not in the explicit map above fall back to this generic
 * brief via platformBrief() below. */
const GENERIC_PLATFORM_BRIEF =
  "a short, clear business update (under 300 characters) appropriate for a general business profile or listing, factual and specific, no hashtags unless the platform is clearly social-media-style.";

function platformBrief(platform: Platform): string {
  return PLATFORM_BRIEF[platform] ?? GENERIC_PLATFORM_BRIEF;
}

/** Platforms that require a video asset rather than a static image. */
const VIDEO_PLATFORMS = new Set<Platform>(["tiktok", "youtube", "vimeo", "instagram", "facebook"]);

/** Phase 7.4: the surfaces a platform actually distinguishes, in default-first
 * order. Platforms not listed here have no real surface distinction beyond
 * their MediaType, so they fall back to "feed" (image) or "video" (video) in
 * surfaceFor() below — this is additive and changes no existing behavior. */
const PLATFORM_SURFACES: Partial<Record<Platform, Surface[]>> = {
  instagram: ["feed", "story", "reel", "carousel"],
  facebook: ["feed", "story", "video"],
  youtube: ["video", "short"],
};

/** Resolves the surface for a post: an explicitly requested surface if the
 * platform actually distinguishes it, otherwise the platform's default, and
 * otherwise the plain image/video fallback every other platform already had. */
export function surfaceFor(platform: Platform, mediaType: MediaType, requested?: Surface): Surface {
  const allowed = PLATFORM_SURFACES[platform];
  if (allowed) {
    if (requested && allowed.includes(requested)) return requested;
    return allowed[0];
  }
  return mediaType === "video" ? "video" : "feed";
}

/** Platforms whose brief calls for hashtags, where SEO-optimized hashtag generation adds value. */
const HASHTAG_PLATFORMS = new Set<Platform>(["instagram", "pinterest", "twitter", "tiktok", "mastodon", "tumblr", "vk", "flickr"]);

/** Maps a review's star rating to a tone descriptor for sentiment-aware review-triggered
 * copy. Reviews below MIN_RATING_FOR_CONTENT (4) never reach here in practice, but this
 * stays conservative for any rating outside the expected positive range. */
function sentimentTone(reviewRating?: number | null): string | null {
  if (reviewRating == null) return null;
  if (reviewRating >= 5) return "warm, genuinely thrilled, and grateful";
  if (reviewRating >= 4) return "appreciative and upbeat";
  return "matter-of-fact and measured";
}

/** Thin exported wrapper around the DeepSeek call below, for callers outside
 * the Content Engine that need a single free-form completion (e.g. Phase
 * 3.3's EDIT auto-rewrite) without duplicating the request/response plumbing. */
export async function callDeepSeekPrompt(prompt: string): Promise<string | null> {
  return callDeepSeek(prompt);
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

/** Builds a single guidance line from non-rejected_phrase brand memory (Phase 7.3),
 * so prior owner EDIT feedback biases new generation rather than just blocking
 * specific words — rejected_phrase entries are handled separately via bannedWords. */
function brandMemoryGuidanceLine(memory: BrandMemory[]): string {
  const relevant = memory.filter((m) => m.category !== "rejected_phrase");
  if (relevant.length === 0) return "";
  const notes = relevant.map((m) => `${m.category.replace(/_/g, " ")}: ${m.content}`);
  return ` Apply this brand guidance learned from past feedback: ${notes.join("; ")}.`;
}

/** Phase 14.5: a short clause folding the business's own significant
 * performance patterns into the prompt by default, so generation leans into
 * what's already worked rather than only reporting it after the fact. */
function styleNudgeLine(styleNudge: string | null): string {
  return styleNudge ? ` Past posts from this business have performed best when they: ${styleNudge}.` : "";
}

async function generateCaption(
  business: Business,
  platform: Platform,
  context?: string,
  reviewRating?: number | null,
  memory: BrandMemory[] = [],
  styleNudge: string | null = null
): Promise<string> {
  const contextLine = context ? ` Base it on this: ${context}.` : "";
  const tone = sentimentTone(reviewRating);
  const toneLine = tone ? ` Write in a tone that's ${tone}, reflecting the sentiment of the feedback it's based on.` : "";
  const memoryLine = brandMemoryGuidanceLine(memory);
  const nudgeLine = styleNudgeLine(styleNudge);

  const result = await callDeepSeek(
    `Write ${platformBrief(platform)} for ${business.name}, located in ${business.location ?? "the local area"}.${contextLine}${toneLine}${memoryLine}${nudgeLine} Keep it specific and concrete, not generic marketing copy.`
  );
  return result ?? `Check out what's new at ${business.name} this week!`;
}

/** Generates a second, distinct caption variant for the same post (Phase 12's
 * per-item richness doubling), so the owner/approval flow can A/B between two
 * options instead of a single fixed caption. Reuses the same platform brief
 * but asks explicitly for a different angle than a typical first draft. */
async function generateCaptionVariantB(
  business: Business,
  platform: Platform,
  context?: string,
  reviewRating?: number | null,
  memory: BrandMemory[] = [],
  styleNudge: string | null = null
): Promise<string | null> {
  const contextLine = context ? ` Base it on this: ${context}.` : "";
  const tone = sentimentTone(reviewRating);
  const toneLine = tone ? ` Write in a tone that's ${tone}, reflecting the sentiment of the feedback it's based on.` : "";
  const memoryLine = brandMemoryGuidanceLine(memory);
  const nudgeLine = styleNudgeLine(styleNudge);

  return callDeepSeek(
    `Write a second, alternative version of ${platformBrief(platform)} for ${business.name}, located in ${business.location ?? "the local area"}.${contextLine}${toneLine}${memoryLine}${nudgeLine} Take a noticeably different angle or hook than a typical first draft would, while staying just as specific and concrete.`
  );
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

/** Generates accessibility alt-text for the post's image/video, as a separate
 * pass since it describes the visual rather than the caption's marketing copy. */
async function generateAltText(business: Business, caption: string): Promise<string | null> {
  return callDeepSeek(
    `Write a concise, descriptive accessibility alt-text (under 125 characters) for the image/video accompanying this post from ${business.name}: "${caption}". Describe what's visually shown, not the marketing message. Respond with only the alt-text.`
  );
}

/** Generates a locally-relevant trending content idea to seed a weekly content
 * brief, so queued posts aren't generic when no review/event context exists. */
export async function generateTrendingIdea(business: Business): Promise<string | null> {
  return callDeepSeek(
    `Suggest one specific, locally-relevant, currently-trending content idea for ${business.name} in ${business.location ?? "the local area"}. Respond with one concise sentence, no preamble.`
  );
}

/** Drafts a suggested public reply to a customer review, for the owner to
 * review/edit/send rather than auto-posting. */
export async function generateReviewReplyDraft(business: Business, review: { rating: number | null; text: string | null; customer_name: string | null }): Promise<string | null> {
  return callDeepSeek(
    `Draft a short, genuine public reply from ${business.name} to this ${review.rating ?? "?"}-star review from ${review.customer_name ?? "a customer"}: "${review.text ?? ""}". Keep it under 300 characters, no generic corporate language.`
  );
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

/** Strips banned brand-voice words/phrases from generated copy (Phase 2.4),
 * matching whole words case-insensitively and collapsing any resulting
 * double spaces. Simple removal rather than regeneration — this is a basic
 * compliance guardrail, not a full review pass. */
function stripBannedWords(caption: string, bannedWords: string[] | null | undefined): string {
  if (!bannedWords || bannedWords.length === 0) return caption;
  let result = caption;
  for (const word of bannedWords) {
    if (!word) continue;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
  }
  return result.replace(/[ \t]{2,}/g, " ").replace(/ +([,.!?])/g, "$1").trim();
}

export async function generatePost(
  business: Business,
  platform: Platform = "gbp",
  context?: string,
  reviewRating?: number | null,
  requestedSurface?: Surface
): Promise<GeneratedPost> {
  const memory = await getBrandMemory(business.id);
  const styleNudge = await getStyleNudge(business);
  let caption = await generateCaption(business, platform, context, reviewRating, memory, styleNudge);
  let captionVariantB = await generateCaptionVariantB(business, platform, context, reviewRating, memory, styleNudge);

  // Phase 4.1: union business-level banned words with the business's org-level
  // defaults (if any) — banned words are a safety guardrail, so an org default
  // should add to a business's own list rather than be overridden by it.
  // Phase 7.3: also fold in rejected_phrase brand memory, so a phrase the owner
  // explicitly rejected in a past EDIT reply is stripped from future generations
  // the same way an org-level banned word is.
  const organization = await getOrganizationForBusiness(business);
  const rejectedPhrases = memory.filter((m) => m.category === "rejected_phrase").map((m) => m.content);
  const bannedWords = [
    ...(business.brand_voice_banned_words ?? []),
    ...(organization?.brand_voice_banned_words ?? []),
    ...rejectedPhrases,
  ];

  caption = stripBannedWords(caption, bannedWords);
  if (captionVariantB) captionVariantB = stripBannedWords(captionVariantB, bannedWords);

  if (business.preferred_language && business.preferred_language.toLowerCase() !== "en") {
    caption = await translateCaption(caption, business.preferred_language);
    if (captionVariantB) captionVariantB = await translateCaption(captionVariantB, business.preferred_language);
  }

  if (HASHTAG_PLATFORMS.has(platform)) {
    const hashtags = await generateHashtags(business, caption, platform);
    if (hashtags.length > 0) caption = `${caption}\n\n${hashtags.join(" ")}`;
    if (captionVariantB) {
      const hashtagsB = await generateHashtags(business, captionVariantB, platform);
      if (hashtagsB.length > 0) captionVariantB = `${captionVariantB}\n\n${hashtagsB.join(" ")}`;
    }
  }

  const mediaType: MediaType = VIDEO_PLATFORMS.has(platform) ? "video" : "image";
  const mediaUrl = mediaType === "video" ? await generateVideo(business, caption) : await generateImage(business, caption);
  const altText = await generateAltText(business, caption);
  const surface = surfaceFor(platform, mediaType, requestedSurface);
  return { caption, captionVariantB, mediaUrl, mediaType, surface, altText };
}
