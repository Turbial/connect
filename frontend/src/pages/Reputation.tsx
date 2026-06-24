import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";
import { Tabs } from "../components/Tabs";
import { DataTable } from "../components/DataTable";
import { FormField } from "../components/FormField";
import { useTab } from "../useTab";

const TABS = [
  { key: "sentiment", label: "Sentiment" },
  { key: "reviews", label: "Reviews" },
  { key: "duplicates", label: "Duplicate Listings" },
];

function SentimentTab({ onError }: { onError: (msg: string) => void }) {
  const [result, setResult] = useState("");

  async function captureSentimentTrend() {
    onError("");
    try {
      await callTool("capture_sentiment_trend");
      setResult("Captured a fresh sentiment-trend snapshot.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Sentiment trend">
        <button onClick={captureSentimentTrend}>Capture sentiment trend</button>
        <div>{result}</div>
      </Card>
    </div>
  );
}

function ReviewsTab({ onError }: { onError: (msg: string) => void }) {
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyDone, setReplyDone] = useState<Record<string, boolean>>({});

  async function load() {
    onError("");
    try {
      const { output } = await callTool<any>("get_operator_snapshot");
      setReviews(output.unresolvedReviews ?? []);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitReply(reviewId: string) {
    if (!replyText.trim()) { onError("Enter a reply first."); return; }
    onError("");
    setReplying(true);
    try {
      await callTool("reply_to_review", { reviewId, responseText: replyText.trim() });
      setReplyDone((prev) => ({ ...prev, [reviewId]: true }));
      setReplyingTo(null);
      setReplyText("");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setReplying(false);
    }
  }

  return (
    <div className="grid">
      <Card title="Unresolved reviews" hint="Pulled from the operator snapshot.">
        <button onClick={load}>Load reviews</button>
        {reviews && (
          <DataTable
            emptyMessage="None unresolved."
            rows={reviews}
            columns={[
              { key: "rating", label: "Rating", render: (r: any) => r.rating ?? "—" },
              { key: "customerName", label: "Customer", render: (r: any) => r.customerName ?? "anonymous" },
              { key: "text", label: "Review", render: (r: any) => r.text ?? "" },
              {
                key: "reply",
                label: "",
                render: (r: any) => {
                  const id = r.id;
                  if (replyDone[id]) return <span className="muted" style={{ fontSize: "0.75rem" }}>replied</span>;
                  return (
                    <button onClick={() => { setReplyingTo(id); setReplyText(""); }}>
                      Reply
                    </button>
                  );
                },
              },
            ]}
          />
        )}
        {replyingTo && (
          <div style={{ marginTop: "1rem" }}>
            <FormField label="Your response">
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Thank you for your feedback…"
              />
            </FormField>
            <div className="row">
              <button disabled={replying} onClick={() => submitReply(replyingTo)}>
                {replying ? "Posting…" : "Post response"}
              </button>
              <button className="secondary" onClick={() => setReplyingTo(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DuplicatesTab({ onError }: { onError: (msg: string) => void }) {
  const [reputationResult, setReputationResult] = useState("");
  const [syncResult, setSyncResult] = useState("");

  async function checkDuplicateListings() {
    onError("");
    try {
      await callTool("check_duplicate_listings");
      setReputationResult("Checked for duplicate listings — see recent agent actions for results.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function syncListingInfo() {
    onError("");
    try {
      await callTool("sync_listing_info");
      setSyncResult("Synced listing info to connected platforms.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Duplicate listings">
        <button onClick={checkDuplicateListings}>Check duplicate listings</button>
        <div>{reputationResult}</div>
      </Card>

      <Card title="Listing sync" hint="Pushes the business's canonical name/address/phone out to connected platforms.">
        <button onClick={syncListingInfo}>Sync listing info</button>
        <div>{syncResult}</div>
      </Card>
    </div>
  );
}

export function Reputation({ onError }: { onError: (msg: string) => void }) {
  const [tab, setTab] = useTab("sentiment");

  return (
    <div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "sentiment" && <SentimentTab onError={onError} />}
      {tab === "reviews" && <ReviewsTab onError={onError} />}
      {tab === "duplicates" && <DuplicatesTab onError={onError} />}
    </div>
  );
}
