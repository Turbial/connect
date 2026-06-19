/**
 * Reuses Reach's email infrastructure (lib/reach-toolkit/email.js) via webhook
 * rather than duplicating SMTP/provider plumbing. REACH_EMAIL_WEBHOOK_URL should
 * point at a Reach endpoint that wraps email.send({ type, template, to, data, project }).
 */
export async function sendApprovalEmail(to: string, subject: string, body: string): Promise<void> {
  const webhookUrl = process.env.REACH_EMAIL_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("REACH_EMAIL_WEBHOOK_URL must be set");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "distribution_approval",
      to,
      project: "mightymax-distribution",
      data: { subject, body },
    }),
  });

  if (!res.ok) {
    throw new Error(`Reach email webhook failed: ${res.status}`);
  }
}
