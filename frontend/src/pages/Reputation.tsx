import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";

export function Reputation({ onError }: { onError: (msg: string) => void }) {
  const [reputationResult, setReputationResult] = useState("");
  const [syncResult, setSyncResult] = useState("");

  async function captureSentimentTrend() {
    onError("");
    try {
      await callTool("capture_sentiment_trend");
      setReputationResult("Captured a fresh sentiment-trend snapshot.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

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
      <Card title="Reputation">
        <button onClick={captureSentimentTrend}>Capture sentiment trend</button>
        <button onClick={checkDuplicateListings}>Check duplicate listings</button>
        <div>{reputationResult}</div>
      </Card>

      <Card title="Listing sync" hint="Pushes the business's canonical name/address/phone out to connected platforms (GBP today).">
        <button onClick={syncListingInfo}>Sync listing info</button>
        <div>{syncResult}</div>
      </Card>
    </div>
  );
}
