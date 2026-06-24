import { useState } from "react";
import { callTool, getCredentialFields, apiFetch, state } from "../api";
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
  { key: "meta", label: "Meta Setup" },
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

const OAUTH_PLATFORMS = [
  { id: "google", label: "Google (GBP)", icon: "G" },
  { id: "facebook", label: "Facebook", icon: "f" },
  { id: "instagram", label: "Instagram", icon: "IG" },
];

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

  function startOAuth(platform: string) {
    const bId = state.businessId;
    if (!bId) { onError("No business loaded."); return; }
    const apiKey = state.apiKey;
    const base = window.location.origin;
    window.location.href = `${base}/oauth/start/${platform}?businessId=${encodeURIComponent(bId)}&token=${encodeURIComponent(apiKey)}`;
  }

  return (
    <div className="grid">
      <Card title="Connection health" hint="Per-platform connection status.">
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

      <Card title="Connect via OAuth" hint="One-click OAuth for supported platforms. You'll be redirected to the platform and back.">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {OAUTH_PLATFORMS.map((p) => (
            <button key={p.id} className="secondary" onClick={() => startOAuth(p.id)}>
              Connect with {p.label}
            </button>
          ))}
        </div>
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
      <Card title="Platform credentials" hint="Manual credential entry. Use the Connections tab for OAuth-supported platforms instead.">
        <div className="row">
          <input type="text" placeholder="platform, e.g. yelp" value={platform} onChange={(e) => setPlatform(e.target.value)} />
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

function MetaSetupTab({ onError }: { onError: (msg: string) => void }) {
  const [pageId, setPageId] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!pageId.trim()) { onError("Enter a Meta Page ID."); return; }
    onError("");
    setSaving(true);
    try {
      await callTool("set_meta_page_id", { metaPageId: pageId.trim() });
      setResult(`Meta Page ID set to "${pageId.trim()}".`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid">
      <Card
        title="Meta Page ID"
        hint="Links your Facebook/Instagram page to this business so incoming DMs and comments from the Meta webhook are routed here. Find your Page ID in Meta Business Suite → Settings → Page Info."
      >
        <FormField label="Meta Page ID">
          <input
            type="text"
            placeholder="e.g. 123456789012345"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
          />
        </FormField>
        <button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
        {result && <p className="muted" style={{ marginTop: "0.5rem" }}>{result}</p>}
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
      {tab === "meta" && <MetaSetupTab onError={onError} />}
    </div>
  );
}
