import { sendApprovalSms } from "./sms.js";
import { sendApprovalEmail } from "./email.js";
import { sendApprovalWhatsapp, contentApprovalButtons } from "./whatsapp.js";
import type { Business } from "../types.js";

/** Phase 7.1: sends an approval-style message via the owner's preferred
 * channel (set on BusinessProfile, Phase 6.2), falling back to whichever of
 * SMS/email is actually configured when no preference is set or the
 * preferred channel's contact info is missing — so a business with no
 * preferred channel set behaves exactly as it did before this existed. */
export async function sendApprovalMessage(business: Business, subject: string, body: string): Promise<void> {
  const preferred = business.owner_preferred_channel;

  if (preferred === "whatsapp" && (business.owner_mobile || business.owner_phone)) {
    await sendApprovalWhatsapp(business.owner_mobile ?? business.owner_phone!, body, { buttons: contentApprovalButtons() });
    return;
  }
  if (preferred === "email" && business.owner_email) {
    await sendApprovalEmail(business.owner_email, subject, body);
    return;
  }
  if (business.owner_phone) {
    await sendApprovalSms(business.owner_phone, body);
    return;
  }
  if (business.owner_email) {
    await sendApprovalEmail(business.owner_email, subject, body);
    return;
  }
  throw new Error(`Business ${business.id} has no owner_phone, owner_email, or owner_mobile`);
}
