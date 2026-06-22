import { useState } from "react";
import { Card } from "../components/Card";
import { Notice } from "../components/Notice";

/** Ported from github.com/Turbial/web-components partials/billing.hbs —
 * same plan shape (name/price/period/features/checkoutUrl/featured) as the
 * shared Handlebars partial. Plan copy matches STANDALONE_PRODUCT_STRATEGY.md
 * §23. No checkout integration exists yet, so "Choose" is honest about that
 * instead of pretending to start a real checkout flow. */
interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Starter Audit",
    price: "Free",
    period: "audit",
    features: ["Visibility Score audit", "Top fixes report", "Competitor snapshot"],
  },
  {
    name: "Local Operator",
    price: "$X",
    period: "month",
    features: ["Weekly content + verified posting", "SMS/Messenger approvals", "Weekly email digest", "Review monitoring"],
    featured: true,
  },
  {
    name: "Growth Operator",
    price: "$X",
    period: "month",
    features: ["A/B creative testing", "Boost policy engine", "Competitor monitoring", "Next-best-fix recommendations"],
  },
  {
    name: "Vertical Pro",
    price: "$X",
    period: "month",
    features: ["Vertical-specific score weights", "Vertical platform mix", "Vertical templates and reports"],
  },
  {
    name: "Agency / White-Label",
    price: "Contact us",
    period: "",
    features: ["Multi-client console", "White-label reports + branded SMS", "Rollups + client billing support"],
  },
  {
    name: "Franchise / Multi-Location",
    price: "Contact us",
    period: "",
    features: ["Corporate/location hierarchy", "Location rollups + comparisons", "Franchise templates"],
  },
];

export function Billing() {
  const [choice, setChoice] = useState("");

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
      </div>
      {choice && <Notice title={`"${choice}" selected`} body="Checkout isn't wired up yet — an operator will follow up to set this up." />}
      <Card title="Plans" hint="Pricing shown is a placeholder until package pricing is finalized.">
        <div className="plans-grid">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`plan-card${plan.featured ? " featured" : ""}`}>
              <h3>{plan.name}</h3>
              <p className="plan-price">
                <strong>{plan.price}</strong>
                {plan.period && <span>/{plan.period}</span>}
              </p>
              <ul className="plan-features">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button onClick={() => setChoice(plan.name)}>Choose {plan.name}</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
