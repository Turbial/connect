/**
 * Reuses Reach's email infrastructure (lib/reach-toolkit/email.js) via webhook
 * rather than duplicating SMTP/provider plumbing. REACH_EMAIL_WEBHOOK_URL should
 * point at a Reach endpoint that wraps email.send({ type, template, to, data, project }).
 */
/** `html`, when passed, rides alongside the existing plain-text `body` —
 * additive only, so a caller that never sets it (the vast majority) sees no
 * change to the webhook payload Reach already receives. Used to give an
 * Agency/Franchise white-label report a logo/color wrapper without changing
 * the plain-text fallback every other report still sends. */
export async function sendApprovalEmail(to: string, subject: string, body: string, html?: string): Promise<void> {
  const webhookUrl = process.env.REACH_EMAIL_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("REACH_EMAIL_WEBHOOK_URL must be set");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "distribution_approval",
      to,
      project: "mightymax-distribution",
      data: html ? { subject, body, html } : { subject, body },
    }),
  });

  if (!res.ok) {
    throw new Error(`Reach email webhook failed: ${res.status}`);
  }
}
