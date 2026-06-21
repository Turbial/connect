import { useState } from "react";
import { callTool } from "../api";
import { Card } from "../components/Card";

export function Branding({ onError }: { onError: (msg: string) => void }) {
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [result, setResult] = useState("");

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
      <Card title="Report branding" hint="Agency/Franchise tiers only — requires white_label_reports feature. Used on weekly report emails.">
        <div className="row">
          <input type="text" placeholder="Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          <input type="text" placeholder="Primary color, e.g. #112233" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
        </div>
        <button onClick={load}>Load current branding</button>
        <button onClick={save}>Save branding</button>
        <div>{result}</div>
      </Card>
    </div>
  );
}
