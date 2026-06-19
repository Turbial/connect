import { supabase } from "./supabase.js";
import { sendApprovalSms } from "../approval/sms.js";
import { recordCustomerMessage } from "./customerMessaging.js";
import type { Business } from "../types.js";

/** Phase 5.3: missed-call text-back — extends the existing "owner approves by
 * text" interaction model to the business's own customers, not the owner.
 * Records the missed call, then auto-replies via SMS using the same Twilio
 * sender the owner-approval flow already uses (sendApprovalSms is a generic
 * Twilio SMS sender despite its name). */
export async function handleMissedCall(businessId: string, callerNumber: string): Promise<void> {
  const { data: business, error } = await supabase.from("business").select("*").eq("id", businessId).single();
  if (error) throw error;

  await recordCustomerMessage({
    businessId,
    channel: "missed_call",
    direction: "inbound",
    customerIdentifier: callerNumber,
    body: null,
  });

  const text = `Thanks for calling ${(business as Business).name}, sorry we missed you — how can we help?`;

  await sendApprovalSms(callerNumber, text);

  await recordCustomerMessage({
    businessId,
    channel: "sms",
    direction: "outbound",
    customerIdentifier: callerNumber,
    body: text,
  });
}
