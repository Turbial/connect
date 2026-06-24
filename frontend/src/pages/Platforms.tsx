import { useState } from "react";
import { callTool, getCredentialFields, apiFetch } from "../api";
import { Card } from "../components/Card";
import { Tabs } from "../components/Tabs";
import { DataTable } from "../components/DataTable";
import { FormField } from "../components/FormField";
import { Tag } from "../components/Tag";
import { useTab } from "../useTab";

const TABS = [
  { key: "connections", label: "Connections" },
  { key: "coverage", label: "Platform Coverage" },
  { key: "credentials", label: "Credentials" },
];

function statusTag(status: string, actionRequired?: boolean) {
  const variant = actionRequired ? "bad" : status === "verified" ? "ok" : "warn";
  return <Tag variant={variant}>{status}</Tag>;
}

const TIER_VARIANT: Record<string, "ok" | "warn" | "bad" | "neutral"> = {
  verified: "ok",
  sandbox: "warn",
  partner_gated: "warn",
  stub: "neutral",
};

function ConnectionsTab({ onError }: { onError: (msg: string) => void }) {
  const [connections, setConnections] = useState<any[] | null>(null);

  async function load() {
    onError("");
    try {
      const { output } = await callTool<any[]>("get_connection_health");
      setConnections(output);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Connection health" hint="Per-platform connection status, flagging which need reconnection.">
        <button onClick={load}>Load connection health</button>
        {connections && (
          <DataTable
            emptyMessage="No connections yet."
            rows={connections}
            columns={[
              { key: "platform", label: "Platform" },
              { key: "status", label: "Status", render: (c: any) => statusTag(c.status, c.actionRequired) },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function CoverageTab({ onError }: { onError: (msg: string) => void }) {
  const [report, setReport] = useState<any[] | null>(null);

  async function load() {
    onError("");
    try {
      const data = await apiFetch<any[]>("platforms/status");
      setReport(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  const byTier = report
    ? (["verified", "sandbox", "partner_gated", "stub"] as const).map((tier) => ({
        tier,
        count: report.filter((p) => p.status === tier).length,
      }))
    : null;

  return (
    <div className="grid">
      <Card
        title="Platform coverage"
        hint="Which platforms have real API adapters (verified), sandbox/test modes, partner-gated access, or are stubs waiting for an adapter."
      >
        <button onClick={load}>Load coverage</button>
        {byTier && (
          <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            {byTier.map(({ tier, count }) => (
              <Tag key={tier} variant={TIER_VARIANT[tier]}>
                {tier.replace("_", " ")}: {count}
              </Tag>
            ))}
          </div>
        )}
        {report && (
          <DataTable
            emptyMessage="No platforms found."
            rows={report}
            columns={[
              { key: "platform", label: "Platform" },
              {
                key: "status",
                label: "Tier",
                render: (p: any) => <Tag variant={TIER_VARIANT[p.status] ?? "neutral"}>{p.status.replace("_", " ")}</Tag>,
              },
              { key: "note", label: "Note", render: (p: any) => p.note ?? <span className="muted">—</span> },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function CredentialsTab({ onError }: { onError: (msg: string) => void }) {
  const [platform, setPlatform] = useState("");
  const [fields, setFields] = useState<string[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState("");

  async function lookupFields() {
    onError("");
    if (!platform.trim()) return;
    try {
      const f = await getCredentialFields(platform.trim());
      setFields(f);
      setValues({});
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveCredentials() {
    onError("");
    try {
      const filtered = Object.fromEntries(Object.entries(values).filter(([, v]) => v));
      await callTool<any>("set_platform_credentials", { platform: platform.trim(), values: filtered });
      setResult(`Credentials saved for ${platform.trim()}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Platform credentials">
        <div className="row">
          <input type="text" placeholder="platform, e.g. facebook" value={platform} onChange={(e) => setPlatform(e.target.value)} />
          <button onClick={lookupFields}>Lookup fields</button>
        </div>
        {fields?.map((f) => (
          <FormField label={f} key={f}>
            <input
              type="password"
              value={values[f] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [f]: e.target.value }))}
            />
          </FormField>
        ))}
        {fields && <button onClick={saveCredentials}>Save credentials</button>}
        <div>{result}</div>
      </Card>
    </div>
  );
}

export function Platforms({ onError }: { onError: (msg: string) => void }) {
  const [tab, setTab] = useTab("connections");

  return (
    <div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "connections" && <ConnectionsTab onError={onError} />}
      {tab === "coverage" && <CoverageTab onError={onError} />}
      {tab === "credentials" && <CredentialsTab onError={onError} />}
    </div>
  );
}
