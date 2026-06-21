import { useState } from "react";
import { callTool, getCredentialFields } from "../api";
import { Card } from "../components/Card";

export function Credentials({ onError }: { onError: (msg: string) => void }) {
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
      const result = await callTool<any>("set_platform_credentials", { platform: platform.trim(), values: filtered });
      setResult(JSON.stringify(result.output ?? result));
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
          <div className="row" key={f}>
            <label>{f}</label>
            <input
              type="password"
              value={values[f] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [f]: e.target.value }))}
            />
          </div>
        ))}
        {fields && <button onClick={saveCredentials}>Save credentials</button>}
        <div>{result}</div>
      </Card>
    </div>
  );
}
