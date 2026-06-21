import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";

export function Org({ onError }: { onError: (msg: string) => void }) {
  const [rollup, setRollup] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<{ loaded: boolean; output: any } | null>(null);

  async function loadRollup() {
    onError("");
    try {
      const { output } = await callTool<any>("get_org_visibility_rollup");
      setRollup(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadBenchmark() {
    onError("");
    try {
      const { output } = await callTool<any>("get_vertical_benchmark");
      setBenchmark({ loaded: true, output });
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Multi-location rollup" hint="Agency/Franchise tiers only — requires multi_location_rollup feature.">
        <button onClick={loadRollup}>Load rollup</button>
        {rollup && (
          <table>
            <tr><th>Location</th><th>Score</th></tr>
            {rollup.locations.map((l: any, i: number) => (
              <tr key={i}>
                <td>{l.businessName}</td>
                <td>{l.score ?? "—"}</td>
              </tr>
            ))}
          </table>
        )}
      </Card>

      <Card title="Vertical benchmark" hint="How this business compares to its industry vertical.">
        <button onClick={loadBenchmark}>Load benchmark</button>
        {benchmark && (benchmark.output ? JSON.stringify(benchmark.output) : "Not enough vertical data yet.")}
      </Card>
    </div>
  );
}
