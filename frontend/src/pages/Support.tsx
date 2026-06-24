import { useState } from "react";
import { apiFetch, state } from "../api";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { Notice } from "../components/Notice";

export function Support() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      await apiFetch("support", {
        method: "POST",
        body: { name: name.trim(), email: email.trim(), message: message.trim(), businessId: state.businessId ?? undefined },
      });
      setSuccess(true);
      setName(""); setEmail(""); setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Support</h1>
      </div>
      <div className="auth-shell">
        <Card title="Contact support" hint="Submit a support ticket and our team will follow up via email.">
          {success && <Notice title="Message sent" body="Your ticket has been filed. We'll get back to you at the email address you provided." />}
          {error && <div className="error">{error}</div>}
          {!success && (
            <div className="auth-card">
              <FormField label="Name">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </FormField>
              <FormField label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </FormField>
              <FormField label="Message">
                <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" />
              </FormField>
              <button onClick={submit} disabled={submitting || !name.trim() || !email.trim() || !message.trim()}>
                {submitting ? "Sending…" : "Send message"}
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
