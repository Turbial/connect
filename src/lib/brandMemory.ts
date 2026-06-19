import { supabase } from "./supabase.js";
import { callDeepSeekPrompt } from "../content-engine/generate.js";
import type { BrandMemory, BrandMemoryCategory } from "../types.js";

const CATEGORIES: BrandMemoryCategory[] = [
  "rejected_phrase",
  "preferred_cta",
  "tone_correction",
  "image_style_preference",
  "platform_preference",
  "forbidden_claim",
  "service_emphasis",
  "offer_to_avoid",
];

export interface ClassifiedEdit {
  category: BrandMemoryCategory;
  content: string;
}

/** Phase 7.3: classifies an owner's free-text EDIT reply into one of the
 * fixed tracked categories, or null when no DEEPSEEK_API_KEY is configured
 * (same graceful-degradation pattern as draftEditRewrite) or the model's
 * answer doesn't match a known category — never invents a category for
 * something the owner didn't actually trigger. */
export async function classifyEditReply(requestedChange: string): Promise<ClassifiedEdit | null> {
  const result = await callDeepSeekPrompt(
    `An owner asked for this change to a social media post: "${requestedChange}". Classify it into exactly one of these categories: ${CATEGORIES.join(", ")}. Then extract the specific content being flagged (e.g. the rejected phrase itself, the preferred CTA text, the tone description). Respond with only "category|content", nothing else.`
  );
  if (!result) return null;

  const [rawCategory, ...rest] = result.split("|");
  const category = rawCategory?.trim() as BrandMemoryCategory;
  const content = rest.join("|").trim();
  if (!CATEGORIES.includes(category) || !content) return null;

  return { category, content };
}

export async function recordBrandMemory(businessId: string, classified: ClassifiedEdit): Promise<void> {
  const { error } = await supabase.from("brand_memory").insert({
    business_id: businessId,
    category: classified.category,
    content: classified.content,
  });
  if (error) throw error;
}

export async function getBrandMemory(businessId: string): Promise<BrandMemory[]> {
  const { data, error } = await supabase.from("brand_memory").select("*").eq("business_id", businessId);
  if (error) throw error;
  return (data ?? []) as BrandMemory[];
}
