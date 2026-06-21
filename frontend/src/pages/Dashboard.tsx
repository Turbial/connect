import { useEffect, useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";

function statusTag(status: string, actionRequired?: boolean) {
  const cls = actionRequired ? "bad" : status === "verified" ? "ok" : "warn";
  return <span className={`tag ${cls}`}>{status}</span>;
}

export function Dashboard({ onError, onLoaded }: { onError: (msg: string) => void; onLoaded: (businessName: string) => void }) {
  const [snapshot, setSnapshot] = useState<any>(null);

  async function load() {
    onError("");
    try {
      const { output } = await callTool<any>("get_operator_snapshot");
      setSnapshot(output);
      onLoaded(output.business?.name ?? "this business");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runAudit() {
    onError("");
    try {
      const { output } = await callTool<any>("run_visibility_audit");
      setSnapshot((prev: any) => ({ ...prev, visibilityScore: output }));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function proposeBoost() {
    onError("");
    try {
      await callTool("propose_boost");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (!snapshot) return <p className="muted">Loading…</p>;
  const score = snapshot.visibilityScore;

  return (
    <div className="grid">
      <Card title="Visibility score">
        {score ? (
          <>
            <div>
              <strong>{score.score ?? "—"}</strong> / 100{score.trend ? ` (${score.trend})` : ""}
            </div>
            {score.drivers?.length > 0 && (
              <ul>
                {score.drivers.map((d: any, i: number) => (
                  <li key={i}>{d.label ?? d.driver ?? JSON.stringify(d)} — {d.impact ?? ""}</li>
                ))}
              </ul>
            )}
            {score.nextBestFix && <p><em>Next best fix:</em> {score.nextBestFix}</p>}
          </>
        ) : (
          "No score computed yet."
        )}
        <button onClick={runAudit}>Run fresh audit</button>
      </Card>

      <Card title="Connections">
        {!snapshot.connections?.length ? (
          "No connections yet."
        ) : (
          <table>
            {snapshot.connections.map((c: any, i: number) => (
              <tr key={i}>
                <td>{c.platform}</td>
                <td>{statusTag(c.status, c.actionRequired)}</td>
              </tr>
            ))}
          </table>
        )}
      </Card>

      <Card title="Pending approvals">
        {!snapshot.pendingApprovals?.length ? (
          "Nothing pending."
        ) : (
          <table>
            {snapshot.pendingApprovals.map((a: any, i: number) => (
              <tr key={i}>
                <td>{a.channel}</td>
                <td>{a.sentAt}</td>
              </tr>
            ))}
          </table>
        )}
      </Card>

      <Card title="Pending boosts">
        {!snapshot.pendingBoosts?.length ? (
          "No pending boosts."
        ) : (
          <ul>
            {snapshot.pendingBoosts.map((b: any, i: number) => (
              <li key={i}>{JSON.stringify(b)}</li>
            ))}
          </ul>
        )}
        <button onClick={proposeBoost}>Evaluate boost triggers</button>
      </Card>

      <Card title="Unresolved reviews">
        {!snapshot.unresolvedReviews?.length ? (
          "None unresolved."
        ) : (
          <table>
            {snapshot.unresolvedReviews.map((r: any, i: number) => (
              <tr key={i}>
                <td>{r.rating ?? "—"}</td>
                <td>{r.customerName ?? "anonymous"}</td>
                <td>{r.text ?? ""}</td>
              </tr>
            ))}
          </table>
        )}
      </Card>

      <Card title="Recent agent actions">
        {!snapshot.recentActions?.length ? (
          "No recent activity."
        ) : (
          <table>
            {snapshot.recentActions.map((a: any, i: number) => (
              <tr key={i}>
                <td>{a.intent ?? a.tool}</td>
                <td>{a.status}</td>
                <td>{a.created_at ?? ""}</td>
              </tr>
            ))}
          </table>
        )}
      </Card>
    </div>
  );
}
