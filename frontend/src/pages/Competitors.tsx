import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";

export function Competitors({ onError }: { onError: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [gbpPlaceId, setGbpPlaceId] = useState("");
  const [result, setResult] = useState("");
  const [competitors, setCompetitors] = useState<any[] | null>(null);
  const [comparison, setComparison] = useState<any>(null);

  async function addCompetitor() {
    onError("");
    if (!name.trim()) return;
    try {
      await callTool("add_competitor", { name: name.trim(), gbpPlaceId: gbpPlaceId.trim() || undefined });
      setResult(`Added competitor "${name.trim()}".`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function captureSnapshots() {
    onError("");
    try {
      await callTool("capture_competitor_snapshots");
      setResult("Captured fresh competitor snapshots.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadCompetitors() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_tracked_competitors");
      setCompetitors(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadComparison() {
    onError("");
    try {
      const { output } = await callTool<any>("get_competitor_comparison");
      setComparison(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Competitors">
        <div className="row">
          <input type="text" placeholder="Competitor name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="text" placeholder="GBP place id (optional)" value={gbpPlaceId} onChange={(e) => setGbpPlaceId(e.target.value)} />
        </div>
        <button onClick={addCompetitor}>Add competitor</button>
        <button onClick={captureSnapshots}>Capture snapshots</button>
        <button onClick={loadCompetitors}>List tracked competitors</button>
        <div>{result}</div>
        {competitors && (!competitors.length ? "No competitors tracked yet." : (
          <table>
            <tr><th>Name</th><th>Rating</th><th>Reviews</th></tr>
            {competitors.map((c: any, i: number) => (
              <tr key={i}>
                <td>{c.name}</td>
                <td>{c.latestSnapshot?.rating ?? "—"}</td>
                <td>{c.latestSnapshot?.review_count ?? "—"}</td>
              </tr>
            ))}
          </table>
        ))}
      </Card>

      <Card title="Competitor comparison" hint="Own visibility score and rating vs. tracked competitors.">
        <button onClick={loadComparison}>Load comparison</button>
        {comparison && (
          <>
            <p>
              Our visibility score: <strong>{comparison.ownVisibilityScore ?? "—"}</strong> | Our avg rating:{" "}
              <strong>{comparison.ownAvgRating ?? "—"}</strong>
            </p>
            <table>
              <tr><th>Competitor</th><th>Rating</th><th>Reviews</th></tr>
              {comparison.competitors.map((c: any, i: number) => (
                <tr key={i}>
                  <td>{c.name}</td>
                  <td>{c.rating ?? "—"}</td>
                  <td>{c.reviewCount ?? "—"}</td>
                </tr>
              ))}
            </table>
          </>
        )}
      </Card>
    </div>
  );
}
