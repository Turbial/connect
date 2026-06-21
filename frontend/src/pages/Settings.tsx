import { useState } from "react";
import { callTool, apiFetch, state as session } from "../api";
import { Card } from "../components/Card";
import { Tabs } from "../components/Tabs";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { FormField } from "../components/FormField";
import { useTab } from "../useTab";

const TABS = [
  { key: "profile", label: "Business Profile" },
  { key: "owner-verification", label: "Owner Verification" },
  { key: "cadence", label: "Posting Cadence" },
  { key: "org", label: "Org & Benchmark" },
  { key: "branding", label: "Report Branding" },
];

function BusinessProfileTab() {
  return (
    <div className="grid">
      <Card title="Business profile">
        <EmptyState message="Not yet available — backend endpoint needed (no update_business tool exists yet)." />
      </Card>
    </div>
  );
}

function OwnerVerificationTab() {
  return (
    <div className="grid">
      <Card title="Owner verification">
        <EmptyState message="Not yet available — backend endpoint needed (no verify_owner tool exists yet)." />
      </Card>
    </div>
  );
}

function PostingCadenceTab() {
  return (
    <div className="grid">
      <Card title="Posting cadence">
        <EmptyState message="Not yet available — backend endpoint needed (no set_posting_cadence tool exists yet)." />
      </Card>
    </div>
  );
}

function OrgTab({ onError }: { onError: (msg: string) => void }) {
  const [rollup, setRollup] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<{ loaded: boolean; output: any } | null>(null);
  const [actions, setActions] = useState<any[] | null>(null);

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

  async function loadActions() {
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
      <Card title="Multi-location rollup" hint="Agency/Franchise tiers only — requires multi_location_rollup feature.">
        <button onClick={loadRollup}>Load rollup</button>
        {rollup && (
          <DataTable
            emptyMessage="No locations found."
            rows={rollup.locations}
            columns={[
              { key: "businessName", label: "Location" },
              { key: "score", label: "Score", render: (l: any) => l.score ?? "—" },
            ]}
          />
        )}
      </Card>

      <Card title="Vertical benchmark" hint="How this business compares to its industry vertical.">
        <button onClick={loadBenchmark}>Load benchmark</button>
        {benchmark && (benchmark.output ? JSON.stringify(benchmark.output) : "Not enough vertical data yet.")}
      </Card>

      <Card title="Agent action queue" hint="Growth/Vertical Pro/Agency/Franchise tiers only — requires agent_action_queue feature.">
        <button onClick={loadActions}>Load action queue</button>
        {actions && (
          <DataTable
            emptyMessage="No agent actions recorded yet."
            rows={actions}
            columns={[
              { key: "tool", label: "Tool" },
              { key: "status", label: "Status" },
              { key: "risk_level", label: "Risk" },
              { key: "created_at", label: "At", render: (a: any) => a.created_at ?? "" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

function BrandingTab({ onError }: { onError: (msg: string) => void }) {
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [result, setResult] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState("");

  async function fetchFromWebsite() {
    onError("");
    setExtractResult("");
    if (!siteUrl.trim()) {
      onError("Enter the business's existing website URL first.");
      return;
    }
    setExtracting(true);
    try {
      const { brand } = await apiFetch<{ brand: any }>(`businesses/${session.businessId}/brand-extract`, {
        method: "POST",
        body: { url: siteUrl.trim() },
      });
      const primary = brand.colors?.primary;
      if (primary) setPrimaryColor(primary);
      if (brand.images?.[0]) setLogoUrl(brand.images[0]);
      setExtractResult(
        `Pulled from ${brand.sourceUrl}: ${Object.keys(brand.colors ?? {}).length} colors, ` +
          `${brand.fonts?.length ?? 0} fonts, ${brand.images?.length ?? 0} images. Review fields below before saving.`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  }

  async function load() {
    onError("");
    try {
      const { output } = await callTool<any>("get_report_branding");
      if (!output) {
        setResult("No branding set (or this tier doesn't include white_label_reports).");
        return;
      }
      setLogoUrl(output.logoUrl ?? "");
      setPrimaryColor(output.primaryColor ?? "");
      setResult("Loaded.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function save() {
    onError("");
    try {
      await callTool("set_report_branding", {
        logoUrl: logoUrl.trim() || undefined,
        primaryColor: primaryColor.trim() || undefined,
      });
      setResult("Saved.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card
        title="Fetch from existing website"
        hint="Pulls colors, fonts, and images off a business's current site so you don't have to guess them by hand."
      >
        <FormField label="Existing website URL">
          <input
            type="text"
            placeholder="https://example.com"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
          />
        </FormField>
        <button onClick={fetchFromWebsite} disabled={extracting}>
          {extracting ? "Fetching…" : "Fetch brand"}
        </button>
        <div>{extractResult}</div>
      </Card>

      <Card title="Report branding" hint="Agency/Franchise tiers only — requires white_label_reports feature. Used on weekly report emails.">
        <FormField label="Logo URL">
          <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </FormField>
        <FormField label="Primary color">
          <input type="text" placeholder="e.g. #112233" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
        </FormField>
        <button onClick={load}>Load current branding</button>
        <button onClick={save}>Save branding</button>
        <div>{result}</div>
      </Card>
    </div>
  );
}

export function Settings({ onError }: { onError: (msg: string) => void }) {
  const [tab, setTab] = useTab("profile");

  return (
    <div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "profile" && <BusinessProfileTab />}
      {tab === "owner-verification" && <OwnerVerificationTab />}
      {tab === "cadence" && <PostingCadenceTab />}
      {tab === "org" && <OrgTab onError={onError} />}
      {tab === "branding" && <BrandingTab onError={onError} />}
    </div>
  );
}
