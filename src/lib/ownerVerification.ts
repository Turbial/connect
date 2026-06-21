import { randomInt } from "node:crypto";
import { supabase } from "./supabase.js";
import { sendApprovalSms } from "../approval/sms.js";
import { isAuthorized } from "../agent-api/auth.js";
import type { Business } from "../types.js";

const CODE_TTL_MS = 10 * 60 * 1000;

/** Phase 15 security hardening: caps how many wrong codes confirmOwnerVerification
 * will accept against a single sent code, so a 10-minute TTL window can't be
 * brute-forced via unlimited HTTP calls (a ~900k-value code space is only safe
 * if guessing is actually rate-limited). */
const MAX_VERIFICATION_ATTEMPTS = 5;

/** Phase 6.4: owner phone verification gate — the weekly loop must not run
 * for a business until this is true on its profile. SMS is the only
 * channel with a working transport today regardless of the owner's
 * preferred channel (Phase 7.1 adds WhatsApp); this never silently sends
 * over a channel that isn't actually wired yet. */
export function isOwnerVerified(business: Business): boolean {
  return business.owner_verified_at !== null;
}

/** Generates and sends a one-time 6-digit code to the owner's mobile number,
 * persisting it (with expiry) on the business row so confirmOwnerVerification
 * can check it without a separate table. */
export async function sendOwnerVerificationCode(business: Business): Promise<void> {
  const ownerPhone = business.owner_mobile ?? business.owner_phone;
  if (!ownerPhone) throw new Error(`sendOwnerVerificationCode: business ${business.id} has no owner mobile/phone on file`);

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error } = await supabase
    .from("business")
    .update({ owner_verification_code: code, owner_verification_code_expires_at: expiresAt, owner_verification_attempts: 0 })
    .eq("id", business.id);
  if (error) throw error;

  await sendApprovalSms(ownerPhone, `Your MightyMax Connect verification code is ${code}. It expires in 10 minutes.`);
}

/** Confirms a code the owner replied with. Returns false (without throwing)
 * for a wrong or expired code, since a mistyped code is an expected user
 * error, not a system failure. */
export async function confirmOwnerVerification(businessId: string, code: string): Promise<boolean> {
  const { data: businessRow, error } = await supabase
    .from("business")
    .select("owner_verification_code, owner_verification_code_expires_at, owner_verification_attempts")
    .eq("id", businessId)
    .single();
  if (error) throw error;
  const business = businessRow as Pick<
    Business,
    "owner_verification_code" | "owner_verification_code_expires_at" | "owner_verification_attempts"
  >;

  if (!business.owner_verification_code) return false;
  if ((business.owner_verification_attempts ?? 0) >= MAX_VERIFICATION_ATTEMPTS) return false;
  if (!business.owner_verification_code_expires_at || new Date(business.owner_verification_code_expires_at).getTime() < Date.now()) {
    return false;
  }

  if (!isAuthorized(code.trim(), business.owner_verification_code)) {
    const { error: attemptError } = await supabase
      .from("business")
      .update({ owner_verification_attempts: (business.owner_verification_attempts ?? 0) + 1 })
      .eq("id", businessId);
    if (attemptError) throw attemptError;
    return false;
  }

  const { error: updateError } = await supabase
    .from("business")
    .update({
      owner_verified_at: new Date().toISOString(),
      owner_verification_code: null,
      owner_verification_code_expires_at: null,
      owner_verification_attempts: 0,
    })
    .eq("id", businessId);
  if (updateError) throw updateError;

  return true;
}
