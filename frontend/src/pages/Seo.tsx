import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";
import { BarChart } from "../components/BarChart";

export function Seo({ onError }: { onError: (msg: string) => void }) {
  const [audit, setAudit] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);

  async function runAudit() {
    onError("");
    try {
      const { output } = await callTool<any>("run_seo_audit");
      setAudit(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadHistory() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_seo_audit_history");
      setHistory(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="SEO audit">
        <button onClick={runAudit}>Run SEO audit</button>
        {audit && (
          <div>
            <div><strong>{audit.score}</strong> / 100</div>
            {audit.issues?.length > 0 && <ul>{audit.issues.map((i: string, idx: number) => <li key={idx}>{i}</li>)}</ul>}
          </div>
        )}
      </Card>

      <Card title="SEO audit history" hint="SEO/citation audit score over time.">
        <button onClick={loadHistory}>Load SEO audit history</button>
        {history && (!history.length ? "No SEO audits run yet." : (
          <>
            <BarChart bars={history.map((e: any, i: number) => ({ label: `#${i + 1}`, value: e.score }))} />
            <table>
              <tr><th>Score</th><th>Issues</th><th>Run at</th></tr>
              {history.map((e: any, i: number) => (
                <tr key={i}>
                  <td>{e.score}</td>
                  <td>{e.issues.join("; ")}</td>
                  <td>{e.runAt}</td>
                </tr>
              ))}
            </table>
          </>
        ))}
      </Card>
    </div>
  );
}
