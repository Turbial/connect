import { useState } from "react";
import { apiFetch, setApiKey, state } from "../api";
import { navigate } from "../router";

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
        <div className="auth-bar">
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
          <span>{error}</span>
        </div>
        <details className="auth-bar">
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
      </header>
      <main>
        <Onboarding apiKey={apiKey} businessId={businessId} setBusinessId={setBusinessIdInput} onLoaded={onLoaded} />
      </main>
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
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");
  const [createResult, setCreateResult] = useState("");
  const [code, setCode] = useState("");
  const [verificationResult, setVerificationResult] = useState("");

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
      setCreateResult(`Created "${body.business.name}" — id ${body.business.id}. Loaded below; add platform credentials next.`);
      onLoaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function sendVerification() {
    setError("");
    const key = apiKey.trim();
    const id = businessId.trim();
    if (!key || !id) {
      setError("Enter both an API key and a business ID above first.");
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
      setError("Enter an API key, business ID, and code first.");
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

  return (
    <>
      {error && <section className="error">{error}</section>}
      <section className="card">
        <h2>New business</h2>
        <p className="muted">Set this business up for the first time, then load it above with the same API key.</p>
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

      <section className="card">
        <h2>Owner verification</h2>
        <p className="muted">Confirms the owner's phone before the weekly content loop will run for them.</p>
        <button onClick={sendVerification}>Send code</button>
        <div className="row">
          <input type="text" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
          <button onClick={confirmVerification}>Confirm</button>
        </div>
        <div>{verificationResult}</div>
      </section>
    </>
  );
}
