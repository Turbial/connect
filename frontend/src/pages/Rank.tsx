import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";
import { BarChart } from "../components/BarChart";

export function Rank({ onError }: { onError: (msg: string) => void }) {
  const [keyword, setKeyword] = useState("");
  const [rankResult, setRankResult] = useState("");
  const [history, setHistory] = useState<any[] | null>(null);

  async function trackRank() {
    onError("");
    try {
      const { output } = await callTool<any>("track_rank", { keyword: keyword.trim() || undefined });
      setRankResult(output.rank === null ? "Not found in results." : `Rank: #${output.rank}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadHistory() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_rank_history");
      setHistory(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Local search rank">
        <div className="row">
          <input type="text" placeholder="Keyword (defaults to business name)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <button onClick={trackRank}>Track rank</button>
        <div>{rankResult}</div>
      </Card>

      <Card title="Rank history" hint="Local search rank snapshots over time.">
        <button onClick={loadHistory}>Load rank history</button>
        {history && (!history.length ? "No rank snapshots captured yet." : (
          <>
            <BarChart bars={history.map((e: any) => ({ label: e.keyword, value: e.rank ?? 0 }))} />
            <table>
              <tr><th>Keyword</th><th>Rank</th><th>Captured at</th></tr>
              {history.map((e: any, i: number) => (
                <tr key={i}>
                  <td>{e.keyword}</td>
                  <td>{e.rank ?? "unranked"}</td>
                  <td>{e.capturedAt}</td>
                </tr>
              ))}
            </table>
          </>
        ))}
      </Card>
    </div>
  );
}
