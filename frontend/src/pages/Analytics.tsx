import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";
import { BarChart } from "../components/BarChart";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";

export function Analytics({ onError }: { onError: (msg: string) => void }) {
  const [scoreHistory, setScoreHistory] = useState<any[] | null>(null);
  const [platformBreakdown, setPlatformBreakdown] = useState<any[] | null>(null);
  const [revenue, setRevenue] = useState<any[] | null>(null);

  async function loadScoreHistory() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_visibility_score_history");
      setScoreHistory(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadPlatformBreakdown() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_platform_breakdown");
      setPlatformBreakdown(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadRevenue() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_revenue_by_platform");
      setRevenue(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      <PageHeader title="Revenue" />
      <div className="grid">
      <Card title="Visibility score trend" hint="Score history across past audits.">
        <button onClick={loadScoreHistory}>Load history</button>
        {scoreHistory && (!scoreHistory.length ? "No audits run yet." : (
          <BarChart bars={scoreHistory.map((p: any) => ({ label: new Date(p.computedAt).toLocaleDateString(), value: p.score }))} />
        ))}
      </Card>

      <Card title="Platform breakdown" hint="Which connected platforms are actually earning attention.">
        <button onClick={loadPlatformBreakdown}>Load breakdown</button>
        {platformBreakdown && (!platformBreakdown.length ? "No posted content yet." : (
          <>
            <p className="muted">Avg score by platform</p>
            <BarChart bars={platformBreakdown.map((e: any) => ({ label: e.platform, value: Number(e.avgScore.toFixed(1)) }))} />
            <DataTable
              emptyMessage="No posted content yet."
              rows={platformBreakdown}
              columns={[
                { key: "platform", label: "Platform" },
                { key: "postCount", label: "Posts" },
                { key: "avgScore", label: "Avg score", render: (e: any) => e.avgScore.toFixed(1) },
                { key: "totalViews", label: "Views" },
                { key: "totalClicks", label: "Clicks" },
                { key: "totalEngagement", label: "Engagement" },
              ]}
            />
          </>
        ))}
      </Card>

      <Card title="Revenue by platform" hint="Calls, form fills, bookings, and Stripe revenue attributed to each platform.">
        <button onClick={loadRevenue}>Load revenue</button>
        {revenue && (!revenue.length ? "No lead/revenue events recorded yet." : (
          <>
            <p className="muted">Revenue ($) by platform</p>
            <BarChart bars={revenue.map((e: any) => ({ label: e.platform, value: Math.round(e.totalAmountCents / 100) }))} />
            <DataTable
              emptyMessage="No lead/revenue events recorded yet."
              rows={revenue}
              columns={[
                { key: "platform", label: "Platform" },
                { key: "leadCount", label: "Leads" },
                { key: "revenue", label: "Revenue", render: (e: any) => `$${(e.totalAmountCents / 100).toFixed(2)}` },
              ]}
            />
          </>
        ))}
      </Card>
      </div>
    </div>
  );
}
