import { useState } from "react";
import { callTool, apiFetch, state as session } from "../api";
import { Card } from "../components/Card";
import { Tabs } from "../components/Tabs";
import { DataTable } from "../components/DataTable";
import { FormField } from "../components/FormField";
import { useTab } from "../useTab";

const TABS = [
  { key: "profile", label: "Business Profile" },
  { key: "owner-verification", label: "Owner Verification" },
  { key: "cadence", label: "Posting Cadence" },
  { key: "org", label: "Org & Benchmark" },
  { key: "branding", label: "Report Branding" },
];

const PROFILE_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Business name" },
  { key: "serviceArea", label: "Service area" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "ownerMobile", label: "Owner mobile" },
  { key: "brandTone", label: "Brand tone" },
];

function BusinessProfileTab({ onError }: { onError: (msg: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState("");

  async function save() {
    onError("");
    setResult("");
    const update: Record<string, string> = {};
    for (const field of PROFILE_FIELDS) {
      if (values[field.key]?.trim()) update[field.key] = values[field.key].trim();
    }
    if (Object.keys(update).length === 0) {
      onError("Enter at least one field to update.");
      return;
    }
    try {
      await callTool("update_business_profile", update);
      setResult("Saved.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Business profile" hint="Only fields you fill in are changed — leave the rest blank.">
        {PROFILE_FIELDS.map((field) => (
          <FormField key={field.key} label={field.label}>
            <input
              type="text"
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          </FormField>
        ))}
        <button onClick={save}>Save profile</button>
        <div>{result}</div>
      </Card>
    </div>
  );
}

function OwnerVerificationTab({ onError }: { onError: (msg: string) => void }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    onError("");
    setResult("");
    setSending(true);
    try {
      await callTool("send_owner_verification_code");
      setResult("Verification code sent.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function confirm() {
    onError("");
    setResult("");
    if (!code.trim()) {
      onError("Enter the code the owner received.");
      return;
    }
    try {
      const { output } = await callTool<{ verified: boolean }>("confirm_owner_verification", { code: code.trim() });
      setResult(output.verified ? "Owner verified." : "Wrong or expired code.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Owner verification" hint="The weekly content loop will not run until the owner is verified.">
        <button onClick={send} disabled={sending}>
          {sending ? "Sending…" : "Send verification code"}
        </button>
        <FormField label="Code from owner">
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} />
        </FormField>
        <button onClick={confirm}>Confirm code</button>
        <div>{result}</div>
      </Card>
    </div>
  );
}

function PostingCadenceTab({ onError }: { onError: (msg: string) => void }) {
  const [cadence, setCadence] = useState("");
  const [result, setResult] = useState("");

  async function save() {
    onError("");
    setResult("");
    if (!cadence.trim()) {
      onError("Enter a posting cadence, e.g. \"3 per week\".");
      return;
    }
    try {
      await callTool("set_posting_cadence", { cadence: cadence.trim() });
      setResult("Saved.");
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid">
      <Card title="Posting cadence" hint="How often the weekly content batch should post for this business.">
        <FormField label="Cadence">
          <input type="text" placeholder="e.g. 3 per week" value={cadence} onChange={(e) => setCadence(e.target.value)} />
        </FormField>
        <button onClick={save}>Save cadence</button>
        <div>{result}</div>
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
      {tab === "profile" && <BusinessProfileTab onError={onError} />}
      {tab === "owner-verification" && <OwnerVerificationTab onError={onError} />}
      {tab === "cadence" && <PostingCadenceTab onError={onError} />}
      {tab === "org" && <OrgTab onError={onError} />}
      {tab === "branding" && <BrandingTab onError={onError} />}
    </div>
  );
}
