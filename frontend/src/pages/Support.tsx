import { useState } from "react";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";

/** Ported from github.com/Turbial/web-components partials/support.hbs —
 * same fields (name/email/message) as the shared Handlebars partial. There's
 * no support-ticket backend yet, so submitting opens a mailto: draft instead
 * of pretending a request was filed somewhere. */
export function Support() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function submit() {
    const body = encodeURIComponent(`From: ${name} <${email}>\n\n${message}`);
    window.location.href = `mailto:support@mightymaxconnect.com?subject=Support request&body=${body}`;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Support</h1>
      </div>
      <div className="auth-shell">
        <Card title="Contact support" hint="Have a question? Opens a draft email — there's no ticketing system wired up yet.">
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
            <button onClick={submit} disabled={!name.trim() || !email.trim() || !message.trim()}>
              Send message
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
