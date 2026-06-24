import { useEffect, useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { Notice } from "../components/Notice";

function statusTag(status: string, actionRequired?: boolean) {
  const variant = actionRequired ? "bad" : status === "verified" ? "ok" : "warn";
  return <Tag variant={variant}>{status}</Tag>;
}

export function Dashboard({ onError, onLoaded }: { onError: (msg: string) => void; onLoaded: (businessName: string) => void }) {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [approvalAction, setApprovalAction] = useState<Record<string, "approving" | "rejecting" | "done">>({});

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

  async function actOnApproval(contentItemId: string, action: "approve_content" | "reject_content") {
    onError("");
    setApprovalAction((prev) => ({ ...prev, [contentItemId]: action === "approve_content" ? "approving" : "rejecting" }));
    try {
      await callTool(action, { contentItemId });
      setApprovalAction((prev) => ({ ...prev, [contentItemId]: "done" }));
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setApprovalAction((prev) => { const n = { ...prev }; delete n[contentItemId]; return n; });
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

  if (!snapshot) return <p className="muted"><span className="spinner" />Loading dashboard…</p>;
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
        <DataTable
          emptyMessage="No connections yet."
          rows={snapshot.connections ?? []}
          columns={[
            { key: "platform", label: "Platform" },
            { key: "status", label: "Status", render: (c: any) => statusTag(c.status, c.actionRequired) },
          ]}
        />
      </Card>

      <Card title="Pending approvals">
        <DataTable
          emptyMessage="Nothing pending."
          rows={snapshot.pendingApprovals ?? []}
          columns={[
            { key: "channel", label: "Channel" },
            { key: "sentAt", label: "Sent at" },
            {
              key: "actions",
              label: "",
              render: (item: any) => {
                const id = item.content_item_id ?? item.id;
                const state = approvalAction[id];
                if (state === "done") return <Tag variant="ok">done</Tag>;
                return (
                  <div className="row" style={{ margin: 0, gap: "0.4rem" }}>
                    <button
                      disabled={!!state}
                      onClick={() => actOnApproval(id, "approve_content")}
                    >
                      {state === "approving" ? "…" : "Approve"}
                    </button>
                    <button
                      className="danger"
                      disabled={!!state}
                      onClick={() => actOnApproval(id, "reject_content")}
                    >
                      {state === "rejecting" ? "…" : "Reject"}
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      </Card>

      <Card title="Pending boosts">
        {!snapshot.pendingBoosts?.length ? (
          "No pending boosts."
        ) : (
          <ul>
            {snapshot.pendingBoosts.map((b: any, i: number) => (
              <li key={i}>{b.platform ?? b.type ?? b.id ?? JSON.stringify(b)}</li>
            ))}
          </ul>
        )}
        <button onClick={proposeBoost}>Evaluate boost triggers</button>
      </Card>

      <Card title="Unresolved reviews">
        <DataTable
          emptyMessage="None unresolved."
          rows={snapshot.unresolvedReviews ?? []}
          columns={[
            { key: "rating", label: "Rating", render: (r: any) => r.rating ?? "—" },
            { key: "customerName", label: "Customer", render: (r: any) => r.customerName ?? "anonymous" },
            { key: "text", label: "Review", render: (r: any) => r.text ?? "" },
          ]}
        />
      </Card>

      <Card title="Recent agent actions">
        <DataTable
          emptyMessage="No recent activity."
          rows={snapshot.recentActions ?? []}
          columns={[
            { key: "intent", label: "Action", render: (a: any) => a.intent ?? a.tool },
            { key: "status", label: "Status" },
            { key: "created_at", label: "At", render: (a: any) => a.created_at ?? "" },
          ]}
        />
      </Card>
    </div>
  );
}
