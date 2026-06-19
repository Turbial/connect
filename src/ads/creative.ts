import { buildUtmLink } from "../lib/utm.js";
import type { AdCreative, Business } from "../types.js";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const FAL_URL = "https://fal.run/fal-ai/flux/schnell";

/**
 * TurboAd generates ad creative (copy variants + image prompts) via this same
 * DeepSeek/fal.ai pairing but exposes no callable API — it's a standalone
 * script, not a deployed service. Rather than depend on TurboAd directly,
 * this module reimplements the creative step so the boost pipeline doesn't
 * need network access to another team's repo to function.
 */
async function generateCopyVariants(business: Business, sourceCaption: string, count: number): Promise<string[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return Array.from({ length: count }, (_, i) => `${sourceCaption} (variant ${i + 1})`);
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: `Write ${count} distinct, short paid-ad copy variants for ${business.name} based on this organic post that performed well: "${sourceCaption}". Each variant under 125 characters, no hashtags, strong call to action. Return one per line, no numbering.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ad copy request failed: ${res.status}`);

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count);
}

async function generateAdImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(FAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` },
    body: JSON.stringify({ prompt, image_size: "square_hd" }),
  });
  if (!res.ok) throw new Error(`fal.ai ad image request failed: ${res.status}`);

  const data = (await res.json()) as { images?: { url: string }[] };
  return data.images?.[0]?.url ?? null;
}

/** Phase 3.1: UTM-tagged destination link for the ad, so attributed
 * clicks/leads can be traced back to this specific boost campaign. Ads
 * already need a destination URL, and there's no other canonical "link
 * embedded in generated content" point yet (captions don't carry a link
 * today), so this is where buildUtmLink() is wired in first. Null when the
 * business hasn't set a website_url. */
function buildAdDestinationLink(business: Business): string | null {
  if (!business.website_url) return null;
  return buildUtmLink(business.website_url, {
    source: business.meta_ads_account_id ? "meta" : "google",
    medium: "paid_social",
    campaign: "boost",
    content: business.id,
  });
}

export async function generateAdCreative(business: Business, sourceCaption: string, variantCount = 3): Promise<AdCreative> {
  const copyVariants = await generateCopyVariants(business, sourceCaption, variantCount);
  const imagePrompts = copyVariants.map((v) => `Photo-realistic ad image for ${business.name}: ${v}`);
  const imageUrls = (await Promise.all(imagePrompts.map(generateAdImage))).filter((url): url is string => url !== null);
  const destinationUrl = buildAdDestinationLink(business);

  return { copyVariants, imagePrompts, imageUrls, destinationUrl };
}
