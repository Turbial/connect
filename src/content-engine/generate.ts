import type { Business, GeneratedPost } from "../types.js";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const FAL_URL = "https://fal.run/fal-ai/flux/schnell";

async function generateCaption(business: Business): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return `Check out what's new at ${business.name} this week!`;
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: `Write a short, local, friendly Google Business Profile post (under 1500 characters, no hashtags) for ${business.name}, located in ${business.location ?? "the local area"}. Highlight a seasonal offer or recent work. Keep it specific and concrete, not generic marketing copy.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek request failed: ${res.status}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content.trim();
}

async function generateImage(business: Business, caption: string): Promise<string | null> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(FAL_URL, {
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
    throw new Error(`fal.ai request failed: ${res.status}`);
  }

  const data = (await res.json()) as { images?: { url: string }[] };
  return data.images?.[0]?.url ?? null;
}

export async function generatePost(business: Business): Promise<GeneratedPost> {
  const caption = await generateCaption(business);
  const mediaUrl = await generateImage(business, caption);
  return { caption, mediaUrl };
}
