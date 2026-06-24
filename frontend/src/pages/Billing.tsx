import { useState } from "react";
import { apiFetch, state } from "../api";
import { Card } from "../components/Card";
import { Notice } from "../components/Notice";
import { Tag } from "../components/Tag";

interface Plan {
  name: string;
  planKey: string | null;
  price: string;
  period: string;
  features: string[];
  featured?: boolean;
  contactSales?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Starter Audit",
    planKey: null,
    price: "Free",
    period: "audit",
    features: ["Visibility Score audit", "Top fixes report", "Competitor snapshot"],
  },
  {
    name: "Local Operator",
    planKey: "local_operator",
    price: "$49",
    period: "month",
    features: ["Weekly content + verified posting", "SMS/Messenger approvals", "Weekly email digest", "Review monitoring"],
    featured: true,
  },
  {
    name: "Growth Operator",
    planKey: "growth_operator",
    price: "$99",
    period: "month",
    features: ["A/B creative testing", "Boost policy engine", "Competitor monitoring", "Next-best-fix recommendations"],
  },
  {
    name: "Vertical Pro",
    planKey: "vertical_pro",
    price: "$149",
    period: "month",
    features: ["Vertical-specific score weights", "Vertical platform mix", "Vertical templates and reports"],
  },
  {
    name: "Agency / White-Label",
    planKey: null,
    price: "Contact us",
    period: "",
    features: ["Multi-client console", "White-label reports + branded SMS", "Rollups + client billing support"],
    contactSales: true,
  },
  {
    name: "Franchise / Multi-Location",
    planKey: null,
    price: "Contact us",
    period: "",
    features: ["Corporate/location hierarchy", "Location rollups + comparisons", "Franchise templates"],
    contactSales: true,
  },
];

// Map business.package_tier to plan key
const TIER_TO_PLAN: Record<string, string> = {
  starter_audit: "Starter Audit",
  local_operator: "Local Operator",
  growth_operator: "Growth Operator",
  vertical_pro: "Vertical Pro",
  agency: "Agency / White-Label",
  franchise: "Franchise / Multi-Location",
};

export function Billing() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState(() => {
    const qs = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    if (qs.get("checkout") === "success") return "Subscription activated — thank you!";
    if (qs.get("checkout") === "cancelled") return "";
    return "";
  });

  // Try to read current plan from snapshot (stored in localStorage after dashboard load)
  const currentTier = (() => {
    try { return JSON.parse(localStorage.getItem("connect_snapshot") ?? "{}").business?.package_tier ?? null; } catch { return null; }
  })();
  const currentPlanName = currentTier ? TIER_TO_PLAN[currentTier] : null;

  async function choosePlan(plan: Plan) {
    if (plan.contactSales) {
      window.location.href = "mailto:sales@mightymaxconnect.com?subject=Enterprise plan inquiry";
      return;
    }
    if (!plan.planKey) return;

    const businessId = state.businessId;
    if (!businessId) { setError("No business loaded — go back to the dashboard first."); return; }

    setError("");
    setLoading(plan.planKey);
    try {
      const { url } = await apiFetch<{ url: string }>("billing/checkout", {
        method: "POST",
        body: { businessId, planKey: plan.planKey },
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
      </div>
      {successMsg && <Notice title="Success" body={successMsg} />}
      {error && <div className="error">{error}</div>}
      <Card title="Plans">
        <div className="plans-grid">
          {PLANS.map((plan) => {
            const isCurrent = plan.name === currentPlanName;
            return (
              <div key={plan.name} className={`plan-card${plan.featured ? " featured" : ""}`}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                  <h3 style={{ margin: 0 }}>{plan.name}</h3>
                  {isCurrent && <Tag variant="ok">Current plan</Tag>}
                </div>
                <p className="plan-price">
                  <strong>{plan.price}</strong>
                  {plan.period && <span>/{plan.period}</span>}
                </p>
                <ul className="plan-features">
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button className="secondary" disabled>Current plan</button>
                ) : plan.contactSales ? (
                  <button className="secondary" onClick={() => choosePlan(plan)}>Contact sales</button>
                ) : plan.planKey ? (
                  <button
                    disabled={loading === plan.planKey}
                    onClick={() => choosePlan(plan)}
                  >
                    {loading === plan.planKey ? "Redirecting…" : `Choose ${plan.name}`}
                  </button>
                ) : (
                  <button className="secondary" disabled>Free</button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
