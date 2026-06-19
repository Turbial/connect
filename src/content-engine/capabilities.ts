import type { Business } from "../types.js";

/**
 * Phase 12's 12 additional AI capabilities (6 → 18 total), following the
 * same pattern as Phase 9/11's standalone functions (generateHashtags,
 * translateCaption, generateAltText, generateTrendingIdea,
 * generateReviewReplyDraft): each is a single focused DeepSeek call,
 * exported for callers to use where relevant rather than hard-wired into
 * every pipeline stage.
 */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

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

/** Suggests an emoji density adjustment for a caption — adds, removes, or
 * rebalances emoji use to match the platform's typical tone. */
export async function tuneEmojiDensity(caption: string, platform: string): Promise<string | null> {
  return callDeepSeek(
    `Rewrite this caption with emoji usage tuned to what's typical for ${platform} (more, fewer, or none, as appropriate): "${caption}". Respond with only the rewritten caption.`
  );
}

/** Generates a short, direct call-to-action line to append to a caption. */
export async function generateCtaLine(business: Business, caption: string): Promise<string | null> {
  return callDeepSeek(
    `Write one short, direct call-to-action line (under 60 characters) to follow this caption for ${business.name}: "${caption}". Respond with only the CTA line.`
  );
}

/** Generates a short headline/title for platforms that need one separately
 * from body copy (e.g. blog-style platforms, YouTube). */
export async function generateHeadline(business: Business, caption: string): Promise<string | null> {
  return callDeepSeek(
    `Write one short, specific headline (under 70 characters) for this post from ${business.name}: "${caption}". Respond with only the headline.`
  );
}

/** Generates a set of alternative subject lines for A/B testing email/notification copy. */
export async function generateAbSubjectLines(business: Business, caption: string): Promise<string[]> {
  const result = await callDeepSeek(
    `Generate 3 distinct, short subject-line variants (under 60 characters each) for an email/notification announcing this update from ${business.name}: "${caption}". Respond with one per line, no numbering or explanation.`
  );
  if (!result) return [];
  return result.split("\n").map((line) => line.trim()).filter(Boolean);
}

/** Suggests local-SEO keywords worth weaving into future copy, based on a caption and location. */
export async function suggestLocalSeoKeywords(business: Business, caption: string): Promise<string[]> {
  const result = await callDeepSeek(
    `Suggest 3-5 local-SEO keyword phrases relevant to this post from ${business.name} in ${business.location ?? "the local area"}: "${caption}". Respond with one phrase per line, no explanation.`
  );
  if (!result) return [];
  return result.split("\n").map((line) => line.trim()).filter(Boolean);
}

/** Checks and trims a caption to fit an accessibility-friendly screen-reader
 * length limit, preserving meaning. */
export async function trimForAccessibility(caption: string, maxLength = 280): Promise<string> {
  if (caption.length <= maxLength) return caption;
  const result = await callDeepSeek(
    `Trim this caption to under ${maxLength} characters for screen-reader accessibility, preserving its core meaning: "${caption}". Respond with only the trimmed caption.`
  );
  return result ?? caption.slice(0, maxLength);
}

/** Suggests a best time-of-day window to post, as human-readable guidance text. */
export async function suggestPostingTime(business: Business, platform: string): Promise<string | null> {
  return callDeepSeek(
    `Suggest the best time-of-day window to post on ${platform} for a local business like ${business.name} in ${business.location ?? "the local area"}. Respond with one short sentence, no preamble.`
  );
}

/** Suggests an angle that differentiates the business from typical local competitors. */
export async function suggestDifferentiationAngle(business: Business, caption: string): Promise<string | null> {
  return callDeepSeek(
    `Suggest one specific angle this post from ${business.name} could take to stand out from typical competitors in the same category: "${caption}". Respond with one concise sentence.`
  );
}

/** Generates a short FAQ-style snippet (question + answer) related to a caption's topic. */
export async function generateFaqSnippet(business: Business, caption: string): Promise<{ question: string; answer: string } | null> {
  const result = await callDeepSeek(
    `Write one likely customer question and a short answer (under 200 characters total) related to this post from ${business.name}: "${caption}". Respond in the exact format "Q: ...\\nA: ..." with no other text.`
  );
  if (!result) return null;
  const match = result.match(/Q:\s*(.*?)\s*\n\s*A:\s*(.*)/s);
  if (!match) return null;
  return { question: match[1].trim(), answer: match[2].trim() };
}

/** Generates a short, genuine urgency phrase (e.g. limited availability) to append to a caption. */
export async function generateUrgencyPhrase(business: Business, caption: string): Promise<string | null> {
  return callDeepSeek(
    `Write one short, genuine urgency phrase (under 50 characters, no false scarcity) that could follow this post from ${business.name}: "${caption}". Respond with only the phrase.`
  );
}

/** Expands a short caption into multi-paragraph long-form copy, for blog-style
 * platforms (Medium, WordPress, Ghost, Substack) that support longer posts. */
export async function expandToLongForm(business: Business, caption: string): Promise<string | null> {
  return callDeepSeek(
    `Expand this short caption into a 3-4 paragraph blog-style post for ${business.name}, keeping the same core message but adding supporting detail and a natural narrative flow: "${caption}". Respond with only the expanded post.`
  );
}

/** Refines a drafted review reply to better match the tone of the original review. */
export async function refineReviewReplyTone(reviewText: string, draftReply: string): Promise<string | null> {
  return callDeepSeek(
    `Refine this draft reply so its tone better matches the tone of the original review, while keeping the same content. Review: "${reviewText}". Draft reply: "${draftReply}". Respond with only the refined reply.`
  );
}
