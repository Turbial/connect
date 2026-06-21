import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";
import { Tabs } from "../components/Tabs";
import { DataTable } from "../components/DataTable";
import { BarChart } from "../components/BarChart";
import { FormField } from "../components/FormField";
import { useTab } from "../useTab";

const TABS = [
  { key: "score", label: "Score" },
  { key: "boosts", label: "Boosts" },
  { key: "competitors", label: "Competitors" },
  { key: "local-seo", label: "Local Search & SEO" },
];

function ScoreTab({ onError }: { onError: (msg: string) => void }) {
  const [score, setScore] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);

  async function loadScore() {
    onError("");
    try {
      const { output } = await callTool<any>("get_visibility_score");
      setScore(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runAudit() {
    onError("");
    try {
      const { output } = await callTool<any>("run_visibility_audit");
      setScore(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadHistory() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_visibility_score_history");
      setHistory(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Visibility score">
        <button onClick={loadScore}>Load current score</button>
        <button onClick={runAudit}>Run fresh audit</button>
        {score ? (
          <>
            <div>
              <strong>{score.score ?? "—"}</strong> / 100{score.trend ? ` (${score.trend})` : ""}
            </div>
            {score.drivers?.length > 0 && (
              <ul>
                {score.drivers.map((d: any, i: number) => (
                  <li key={i}>
                    {d.label ?? d.driver ?? JSON.stringify(d)} — {d.impact ?? ""}
                  </li>
                ))}
              </ul>
            )}
            {score.nextBestFix && (
              <p>
                <em>Next best fix:</em> {score.nextBestFix}
              </p>
            )}
          </>
        ) : (
          "No score loaded yet."
        )}
      </Card>

      <Card title="Score history" hint="Visibility score across past audits.">
        <button onClick={loadHistory}>Load history</button>
        {history &&
          (history.length === 0 ? (
            <p className="muted">No audits run yet.</p>
          ) : (
            <BarChart bars={history.map((p: any) => ({ label: new Date(p.computedAt).toLocaleDateString(), value: p.score }))} />
          ))}
      </Card>
    </div>
  );
}

function BoostsTab({ onError }: { onError: (msg: string) => void }) {
  const [history, setHistory] = useState<any[] | null>(null);

  async function loadHistory() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_boost_history");
      setHistory(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Boost history" hint="Every boost ever proposed — declined and launched alike.">
        <button onClick={loadHistory}>Load boost history</button>
        {history && (
          <DataTable
            emptyMessage="No boosts proposed yet."
            rows={history}
            columns={[
              { key: "platform", label: "Platform" },
              { key: "ownerResponse", label: "Response", render: (e: any) => e.ownerResponse ?? "pending" },
              { key: "adPlatform", label: "Ad platform", render: (e: any) => e.adPlatform ?? "" },
              { key: "thresholdMetAt", label: "Triggered at" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function CompetitorsTab({ onError }: { onError: (msg: string) => void }) {
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
        {competitors && (
          <DataTable
            emptyMessage="No competitors tracked yet."
            rows={competitors}
            columns={[
              { key: "name", label: "Name" },
              { key: "rating", label: "Rating", render: (c: any) => c.latestSnapshot?.rating ?? "—" },
              { key: "reviews", label: "Reviews", render: (c: any) => c.latestSnapshot?.review_count ?? "—" },
            ]}
          />
        )}
      </Card>

      <Card title="Competitor comparison" hint="Own visibility score and rating vs. tracked competitors.">
        <button onClick={loadComparison}>Load comparison</button>
        {comparison && (
          <>
            <p>
              Our visibility score: <strong>{comparison.ownVisibilityScore ?? "—"}</strong> | Our avg rating:{" "}
              <strong>{comparison.ownAvgRating ?? "—"}</strong>
            </p>
            <DataTable
              emptyMessage="No competitors tracked yet."
              rows={comparison.competitors}
              columns={[
                { key: "name", label: "Competitor" },
                { key: "rating", label: "Rating", render: (c: any) => c.rating ?? "—" },
                { key: "reviewCount", label: "Reviews", render: (c: any) => c.reviewCount ?? "—" },
              ]}
            />
          </>
        )}
      </Card>
    </div>
  );
}

function LocalSearchSeoTab({ onError }: { onError: (msg: string) => void }) {
  const [keyword, setKeyword] = useState("");
  const [rankResult, setRankResult] = useState("");
  const [rankHistory, setRankHistory] = useState<any[] | null>(null);
  const [audit, setAudit] = useState<any>(null);
  const [seoHistory, setSeoHistory] = useState<any[] | null>(null);

  async function trackRank() {
    onError("");
    try {
      const { output } = await callTool<any>("track_rank", { keyword: keyword.trim() || undefined });
      setRankResult(output.rank === null ? "Not found in results." : `Rank: #${output.rank}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadRankHistory() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_rank_history");
      setRankHistory(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runSeoAudit() {
    onError("");
    try {
      const { output } = await callTool<any>("run_seo_audit");
      setAudit(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadSeoHistory() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_seo_audit_history");
      setSeoHistory(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Local search rank">
        <FormField label="Keyword (defaults to business name)">
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </FormField>
        <button onClick={trackRank}>Track rank</button>
        <div>{rankResult}</div>

        <h3>Rank history</h3>
        <button onClick={loadRankHistory}>Load rank history</button>
        {rankHistory && (
          <>
            {rankHistory.length > 0 && (
              <BarChart bars={rankHistory.map((e: any) => ({ label: e.keyword, value: e.rank ?? 0 }))} />
            )}
            <DataTable
              emptyMessage="No rank snapshots captured yet."
              rows={rankHistory}
              columns={[
                { key: "keyword", label: "Keyword" },
                { key: "rank", label: "Rank", render: (e: any) => e.rank ?? "unranked" },
                { key: "capturedAt", label: "Captured at" },
              ]}
            />
          </>
        )}
      </Card>

      <Card title="SEO audit">
        <button onClick={runSeoAudit}>Run SEO audit</button>
        {audit && (
          <div>
            <div>
              <strong>{audit.score}</strong> / 100
            </div>
            {audit.issues?.length > 0 && (
              <ul>
                {audit.issues.map((i: string, idx: number) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <h3>SEO audit history</h3>
        <button onClick={loadSeoHistory}>Load SEO audit history</button>
        {seoHistory && (
          <>
            {seoHistory.length > 0 && (
              <BarChart bars={seoHistory.map((e: any, i: number) => ({ label: `#${i + 1}`, value: e.score }))} />
            )}
            <DataTable
              emptyMessage="No SEO audits run yet."
              rows={seoHistory}
              columns={[
                { key: "score", label: "Score" },
                { key: "issues", label: "Issues", render: (e: any) => e.issues.join("; ") },
                { key: "runAt", label: "Run at" },
              ]}
            />
          </>
        )}
      </Card>
    </div>
  );
}

export function Growth({ onError }: { onError: (msg: string) => void }) {
  const [tab, setTab] = useTab("score");

  return (
    <div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "score" && <ScoreTab onError={onError} />}
      {tab === "boosts" && <BoostsTab onError={onError} />}
      {tab === "competitors" && <CompetitorsTab onError={onError} />}
      {tab === "local-seo" && <LocalSearchSeoTab onError={onError} />}
    </div>
  );
}
