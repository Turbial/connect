import { supabase } from "./supabase.js";
import { upsertConnection } from "./platformConnection.js";
import type { Platform } from "../types.js";

/** A handful of platforms split their credential across more than one
 * business-table column (e.g. GBP's access/refresh token + location id) —
 * everything else follows the single `${platform}_access_token` column
 * convention already used across all 108 platforms (see src/types.ts'
 * Business interface). */
const CREDENTIAL_FIELD_OVERRIDES: Partial<Record<Platform, string[]>> = {
  gbp: ["gbp_access_token", "gbp_refresh_token", "gbp_location_id"],
  facebook: ["fb_page_access_token", "fb_page_id"],
  instagram: ["fb_page_access_token", "ig_business_id"],
  wechat: ["wechat_access_token", "wechat_official_account_id"],
  whatsapp: ["whatsapp_access_token", "whatsapp_phone_number_id", "whatsapp_broadcast_recipient"],
};

/** The business-table column(s) that hold a given platform's credentials —
 * the exact allowlist setPlatformCredentials validates against, so a write
 * coming in over the agent API can never touch a column outside this set. */
export function credentialFieldsFor(platform: Platform): string[] {
  return CREDENTIAL_FIELD_OVERRIDES[platform] ?? [`${platform}_access_token`];
}

export interface SetPlatformCredentialsResult {
  platform: Platform;
  fieldsSet: string[];
}

/** Phase 10: lets an agent (or onboarding flow) configure the credentials a
 * platform needs to actually post — writes to the same business-table
 * columns every existing distribution adapter already reads, then syncs
 * platform_connection so getConnectionSummary reflects it immediately.
 * Only ever returns which fields were set, never their values, so a secret
 * submitted once is never echoed back in a tool result or audit log. */
export async function setPlatformCredentials(
  businessId: string,
  platform: Platform,
  values: Record<string, string>
): Promise<SetPlatformCredentialsResult> {
  const allowedFields = credentialFieldsFor(platform);
  const update: Record<string, string> = {};
  for (const [field, value] of Object.entries(values)) {
    if (!allowedFields.includes(field)) {
      throw new Error(`"${field}" is not a valid credential field for platform "${platform}". Valid fields: ${allowedFields.join(", ")}`);
    }
    update[field] = value;
  }
  if (Object.keys(update).length === 0) {
    throw new Error(`No valid credential fields provided for platform "${platform}". Valid fields: ${allowedFields.join(", ")}`);
  }

  const { error } = await supabase.from("business").update(update).eq("id", businessId);
  if (error) throw error;

  const accountIdField = allowedFields.find((f) => f.endsWith("_id"));
  const tokenField = allowedFields.find((f) => f.endsWith("_access_token"));
  await upsertConnection({
    businessId,
    platform,
    accountId: (accountIdField && update[accountIdField]) ?? null,
    accessTokenRef: (tokenField && update[tokenField]) ?? null,
    status: "sandbox",
  });

  return { platform, fieldsSet: Object.keys(update) };
}
