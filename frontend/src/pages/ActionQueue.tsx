import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";

export function ActionQueue({ onError }: { onError: (msg: string) => void }) {
  const [actions, setActions] = useState<any[] | null>(null);

  async function load() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_agent_action_queue");
      setActions(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Agent action queue" hint="Growth/Vertical Pro/Agency/Franchise tiers only — requires agent_action_queue feature.">
        <button onClick={load}>Load action queue</button>
        {actions && (!actions.length ? "No agent actions recorded yet." : (
          <table>
            <tr><th>Tool</th><th>Status</th><th>Risk</th><th>At</th></tr>
            {actions.map((a: any, i: number) => (
              <tr key={i}>
                <td>{a.tool}</td>
                <td>{a.status}</td>
                <td>{a.risk_level}</td>
                <td>{a.created_at ?? ""}</td>
              </tr>
            ))}
          </table>
        ))}
      </Card>
    </div>
  );
}
