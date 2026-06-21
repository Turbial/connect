import { sendApprovalSms } from "./sms.js";
import { sendApprovalEmail } from "./email.js";
import { sendApprovalWhatsapp, contentApprovalButtons } from "./whatsapp.js";
import { getOrganizationForBusiness } from "../lib/orgSettings.js";
import type { Business } from "../types.js";

/** Phase 7.1: sends an approval-style message via the owner's preferred
 * channel (set on BusinessProfile, Phase 6.2), falling back to whichever of
 * SMS/email is actually configured when no preference is set or the
 * preferred channel's contact info is missing — so a business with no
 * preferred channel set behaves exactly as it did before this existed.
 * Phase 8.7: also resolves the business's org sender-identity overrides
 * (twilio_from_number/whatsapp_phone_number_id) so an agency-managed
 * business's SMS/WhatsApp messages come from the agency's own line, not
 * MightyMax's default — a business with no org behaves unchanged. */
export async function sendApprovalMessage(business: Business, subject: string, body: string): Promise<void> {
  const preferred = business.owner_preferred_channel;
  const organization = await getOrganizationForBusiness(business);

  if (preferred === "whatsapp" && (business.owner_mobile || business.owner_phone)) {
    await sendApprovalWhatsapp(business.owner_mobile ?? business.owner_phone!, body, {
      buttons: contentApprovalButtons(),
      phoneNumberIdOverride: organization?.whatsapp_phone_number_id ?? null,
    });
    return;
  }
  if (preferred === "email" && business.owner_email) {
    await sendApprovalEmail(business.owner_email, subject, body);
    return;
  }
  if (business.owner_phone) {
    await sendApprovalSms(business.owner_phone, body, organization?.twilio_from_number ?? null);
    return;
  }
  if (business.owner_email) {
    await sendApprovalEmail(business.owner_email, subject, body);
    return;
  }
  throw new Error(`Business ${business.id} has no owner_phone, owner_email, or owner_mobile`);
}
