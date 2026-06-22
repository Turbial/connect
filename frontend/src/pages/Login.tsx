import { useState } from "react";
import { apiFetch, callTool, getCredentialFields, setApiKey, state } from "../api";
import { navigate } from "../router";
import { PageHeader } from "../components/PageHeader";
import { FormField } from "../components/FormField";

export function Login({ onLoaded }: { onLoaded: () => void }) {
  const [apiKey, setApiKeyInput] = useState(state.apiKey);
  const [businessId, setBusinessIdInput] = useState(state.businessId);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authResult, setAuthResult] = useState("");

  function handleLoad() {
    const key = apiKey.trim();
    const id = businessId.trim();
    if (!key || !id) {
      setError("Enter both an API key and a business ID.");
      return;
    }
    setApiKey(key);
    localStorage.setItem("connect_business_id", id);
    state.businessId = id;
    onLoaded();
  }

  async function handleAuth(routePath: string) {
    if (!email.trim() || !password) {
      setAuthResult("Enter an email and password first.");
      return;
    }
    try {
      const body = await apiFetch<{ token: string }>(routePath, {
        method: "POST",
        body: { email: email.trim(), password },
      });
      setApiKey(body.token);
      setApiKeyInput(body.token);
      setAuthResult("Logged in — now create or load a business below.");
    } catch (err) {
      setAuthResult(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      <header>
        <h1>Connect</h1>
      </header>
      <main>
        <div className="auth-shell">
          <div className="auth-card card">
            <h2>Sign in</h2>
            <p className="muted">Enter your agent API key and business ID to load this business</p>
            <div className="row">
              <input
                type="password"
                placeholder="Agent API key or session token"
                value={apiKey}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <input
                type="text"
                placeholder="Business ID"
                value={businessId}
                onChange={(e) => setBusinessIdInput(e.target.value)}
              />
              <button onClick={handleLoad}>Load</button>
            </div>
            {error && <p className="error-text">{error}</p>}
            <details>
              <summary>Or log in / sign up</summary>
              <div className="row">
                <input type="text" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input
                  type="password"
                  placeholder="Password (8+ chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button onClick={() => handleAuth("auth/login")}>Log in</button>
                <button onClick={() => handleAuth("auth/signup")}>Sign up</button>
              </div>
              <div>{authResult}</div>
            </details>
          </div>
        </div>
        <Onboarding apiKey={apiKey} businessId={businessId} setBusinessId={setBusinessIdInput} onLoaded={onLoaded} />
      </main>
    </div>
  );
}

type WizardStep = 1 | 2 | 3;

function StepIndicator({ step, businessId }: { step: WizardStep; businessId: string }) {
  const labels: Record<WizardStep, string> = {
    1: "Create business",
    2: "Verify owner",
    3: "Connect a platform",
  };
  return (
    <div className="steps">
      {([1, 2, 3] as WizardStep[]).map((n) => {
        const disabled = n === 2 && !businessId;
        return (
          <span
            key={n}
            className={`step ${n === step ? "active" : ""} ${n < step ? "done" : ""} ${disabled ? "disabled" : ""}`}
          >
            <span className="step-num">{n < step ? "✓" : n}</span>
            {labels[n]}
          </span>
        );
      })}
    </div>
  );
}

function Onboarding({
  apiKey,
  businessId,
  setBusinessId,
  onLoaded,
}: {
  apiKey: string;
  businessId: string;
  setBusinessId: (id: string) => void;
  onLoaded: () => void;
}) {
  const [step, setStep] = useState<WizardStep>(businessId ? 2 : 1);
  const [error, setError] = useState("");

  // Step 1: create business
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");
  const [createResult, setCreateResult] = useState("");

  // Step 2: owner verification
  const [code, setCode] = useState("");
  const [verificationResult, setVerificationResult] = useState("");

  // Step 3: connect first platform
  const [platform, setPlatform] = useState("");
  const [fields, setFields] = useState<string[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [credentialResult, setCredentialResult] = useState("");

  async function createBusiness() {
    setError("");
    if (!name.trim()) {
      setError("Business name is required.");
      return;
    }
    const key = apiKey.trim();
    if (!key) {
      setError("Enter an Agent API key above first.");
      return;
    }
    try {
      const body = await apiFetch<{ business: { id: string; name: string } }>("businesses", {
        method: "POST",
        apiKey: key,
        body: {
          name: name.trim(),
          location: location.trim() || undefined,
          phone: phone.trim() || undefined,
          ownerPhone: ownerPhone.trim() || undefined,
          ownerEmail: ownerEmail.trim() || undefined,
          ownerMobile: ownerMobile.trim() || undefined,
        },
      });
      setApiKey(key);
      setBusinessId(body.business.id);
      localStorage.setItem("connect_business_id", body.business.id);
      state.businessId = body.business.id;
      setCreateResult(`Created "${body.business.name}" — id ${body.business.id}.`);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function sendVerification() {
    setError("");
    const key = apiKey.trim();
    const id = businessId.trim();
    if (!key || !id) {
      setError("Create a business first.");
      return;
    }
    try {
      await apiFetch(`businesses/${id}/owner-verification/send`, { method: "POST", apiKey: key });
      setVerificationResult("Code sent — check the owner's phone.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function confirmVerification() {
    setError("");
    const key = apiKey.trim();
    const id = businessId.trim();
    if (!key || !id || !code.trim()) {
      setError("Enter the code sent to the owner first.");
      return;
    }
    try {
      const body = await apiFetch<{ verified: boolean }>(`businesses/${id}/owner-verification/confirm`, {
        method: "POST",
        apiKey: key,
        body: { code: code.trim() },
      });
      setVerificationResult(body.verified ? "Verified." : "Incorrect or expired code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function lookupFields() {
    setError("");
    if (!platform.trim()) return;
    try {
      const f = await getCredentialFields(platform.trim());
      setFields(f);
      setValues({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveCredentials() {
    setError("");
    try {
      const filtered = Object.fromEntries(Object.entries(values).filter(([, v]) => v));
      await callTool<any>("set_platform_credentials", { platform: platform.trim(), values: filtered });
      setCredentialResult(`Saved credentials for "${platform.trim()}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <PageHeader title="Set up your business" />
      <StepIndicator step={step} businessId={businessId} />
      {error && <section className="error">{error}</section>}

      {step === 1 && (
        <section className="card">
          <h2>1. New business</h2>
          <p className="muted">Set this business up for the first time.</p>
          <div className="row">
            <input type="text" placeholder="Business name (required)" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="text" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="row">
            <input type="text" placeholder="Business phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input
              type="text"
              placeholder="Owner phone (SMS approvals)"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
            />
          </div>
          <div className="row">
            <input type="text" placeholder="Owner email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
            <input
              type="text"
              placeholder="Owner mobile (WhatsApp)"
              value={ownerMobile}
              onChange={(e) => setOwnerMobile(e.target.value)}
            />
          </div>
          <button onClick={createBusiness}>Create business</button>
          <div>{createResult}</div>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <h2>2. Owner verification</h2>
          <p className="muted">Confirms the owner's phone before the weekly content loop will run for them.</p>
          <button onClick={sendVerification}>Send code</button>
          <div className="row">
            <input type="text" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button onClick={confirmVerification}>Confirm</button>
          </div>
          <div>{verificationResult}</div>
          <div className="row">
            <button onClick={() => setStep(1)}>Back</button>
            <button onClick={() => setStep(3)}>Next: connect a platform</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card">
          <h2>3. Connect your first platform</h2>
          <p className="muted">Add credentials for one platform now, or skip and do this later from Platforms.</p>
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
          <div>{credentialResult}</div>
          <div className="row">
            <button onClick={() => setStep(2)}>Back</button>
            <button onClick={onLoaded}>{credentialResult ? "Done" : "Skip for now"}</button>
          </div>
        </section>
      )}
    </>
  );
}
