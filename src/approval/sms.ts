import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (client) return client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }
  client = twilio(sid, token);
  return client;
}

/** Phase 8.7: fromOverride lets an org's own Twilio number stand in for the
 * platform default, so an agency's clients see the agency's sender identity
 * end-to-end — null/omitted falls back to TWILIO_FROM_NUMBER unchanged. */
export async function sendApprovalSms(to: string, body: string, fromOverride?: string | null): Promise<void> {
  const from = fromOverride ?? process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error("TWILIO_FROM_NUMBER must be set");

  await getClient().messages.create({ to, from, body });
}

/** Parses an owner's SMS reply into an approval decision. */
export function parseReply(body: string): "approve" | "reject" | "edit" | "unknown" {
  const normalized = body.trim().toLowerCase();
  if (normalized === "yes" || normalized === "y") return "approve";
  if (normalized === "no" || normalized === "n") return "reject";
  if (normalized.startsWith("edit")) return "edit";
  return "unknown";
}
