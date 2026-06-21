import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";

export function Boosts({ onError }: { onError: (msg: string) => void }) {
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
        {history && (!history.length ? "No boosts proposed yet." : (
          <table>
            <tr><th>Platform</th><th>Response</th><th>Ad platform</th><th>Triggered at</th></tr>
            {history.map((e: any, i: number) => (
              <tr key={i}>
                <td>{e.platform}</td>
                <td>{e.ownerResponse ?? "pending"}</td>
                <td>{e.adPlatform ?? ""}</td>
                <td>{e.thresholdMetAt}</td>
              </tr>
            ))}
          </table>
        ))}
      </Card>
    </div>
  );
}
