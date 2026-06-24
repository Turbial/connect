import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";
import { DataTable } from "../components/DataTable";
import { FormField } from "../components/FormField";
import { Tag } from "../components/Tag";

const INTENT_VARIANT: Record<string, "ok" | "warn" | "bad" | "neutral"> = {
  lead_intent: "ok",
  question: "neutral",
  complaint: "bad",
  other: "neutral",
};

const CHANNEL_LABELS: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  missed_call: "Missed call",
  webchat: "Webchat",
  dm_instagram: "Instagram DM",
  dm_facebook: "Facebook DM",
};

const REPLYABLE_CHANNELS = ["sms", "whatsapp"];

function ChannelLabel({ channel }: { channel: string }) {
  return <span>{CHANNEL_LABELS[channel] ?? channel}</span>;
}

export function Inbox({ onError }: { onError: (msg: string) => void }) {
  const [messages, setMessages] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sinceISO, setSinceISO] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });

  // Reply state
  const [replyTo, setReplyTo] = useState<{ id: string; channel: string } | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyResult, setReplyResult] = useState("");

  async function load() {
    onError("");
    setLoading(true);
    try {
      const { output } = await callTool<any[]>("get_inbox", {
        sinceISO: new Date(sinceISO).toISOString(),
      });
      setMessages(output ?? []);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(customerIdentifier: string, channel: string) {
    onError("");
    setReplyResult("");
    if (!replyBody.trim()) {
      onError("Enter a reply message first.");
      return;
    }
    try {
      await callTool("reply_to_customer", {
        customerIdentifier,
        channel,
        body: replyBody.trim(),
      });
      setReplyResult("Reply sent.");
      setReplyTo(null);
      setReplyBody("");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  const inbound = messages?.filter((m) => m.direction === "inbound") ?? [];
  const outbound = messages?.filter((m) => m.direction === "outbound") ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Inbox</h1>
      </div>
      <div className="grid">
        <Card
          title="Customer messages"
          hint="Customer messages across SMS, WhatsApp, Instagram DM, and Facebook DM. Reply is available for SMS and WhatsApp channels."
        >
          <div className="row">
            <FormField label="Since">
              <input
                type="date"
                value={sinceISO}
                onChange={(e) => setSinceISO(e.target.value)}
              />
            </FormField>
            <button onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Load messages"}
            </button>
          </div>

          {messages !== null && (
            <>
              <h3 style={{ marginTop: "1rem" }}>
                Inbound{" "}
                <Tag variant={inbound.length > 0 ? "ok" : "neutral"}>{inbound.length}</Tag>
              </h3>
              <DataTable
                emptyMessage="No inbound messages in this window."
                rows={inbound}
                columns={[
                  { key: "created_at", label: "When", render: (m: any) => new Date(m.created_at).toLocaleString() },
                  { key: "channel", label: "Channel", render: (m: any) => <ChannelLabel channel={m.channel} /> },
                  { key: "customer_identifier", label: "From" },
                  { key: "body", label: "Message", render: (m: any) => m.body ?? <em className="muted">—</em> },
                  {
                    key: "intent",
                    label: "Intent",
                    render: (m: any) =>
                      m.intent ? (
                        <Tag variant={INTENT_VARIANT[m.intent] ?? "neutral"}>{m.intent.replace("_", " ")}</Tag>
                      ) : (
                        <span className="muted">—</span>
                      ),
                  },
                  {
                    key: "reply",
                    label: "",
                    render: (m: any) =>
                      REPLYABLE_CHANNELS.includes(m.channel) ? (
                        <button
                          onClick={() => {
                            setReplyTo({ id: m.customer_identifier, channel: m.channel });
                            setReplyBody("");
                            setReplyResult("");
                          }}
                        >
                          Reply
                        </button>
                      ) : null,
                  },
                ]}
              />

              {replyTo && (
                <div className="card" style={{ marginTop: "1rem" }}>
                  <p className="muted">
                    Replying to <strong>{replyTo.id}</strong> via <strong>{CHANNEL_LABELS[replyTo.channel] ?? replyTo.channel}</strong>
                  </p>
                  <FormField label="Message">
                    <textarea
                      rows={3}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Your reply…"
                    />
                  </FormField>
                  <div className="row">
                    <button onClick={() => sendReply(replyTo.id, replyTo.channel)}>Send</button>
                    <button className="secondary" onClick={() => setReplyTo(null)}>Cancel</button>
                  </div>
                  {replyResult && <p className="muted">{replyResult}</p>}
                </div>
              )}

              <h3 style={{ marginTop: "1.5rem" }}>
                Outbound{" "}
                <Tag variant="neutral">{outbound.length}</Tag>
              </h3>
              <DataTable
                emptyMessage="No outbound messages in this window."
                rows={outbound}
                columns={[
                  { key: "created_at", label: "When", render: (m: any) => new Date(m.created_at).toLocaleString() },
                  { key: "channel", label: "Channel", render: (m: any) => <ChannelLabel channel={m.channel} /> },
                  { key: "customer_identifier", label: "To" },
                  { key: "body", label: "Message", render: (m: any) => m.body ?? <em className="muted">—</em> },
                ]}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
