import { useState } from "react";
import { useHashRoute, navigate } from "./router";
import { clearSession, state } from "./api";
import { Nav } from "./components/Nav";
import { ErrorBanner } from "./components/ErrorBanner";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Content } from "./pages/Content";
import { Boosts } from "./pages/Boosts";
import { Competitors } from "./pages/Competitors";
import { Rank } from "./pages/Rank";
import { Seo } from "./pages/Seo";
import { Reputation } from "./pages/Reputation";
import { Analytics } from "./pages/Analytics";
import { Org } from "./pages/Org";
import { Branding } from "./pages/Branding";
import { ActionQueue } from "./pages/ActionQueue";
import { Credentials } from "./pages/Credentials";

const PAGES: Record<string, (props: { onError: (msg: string) => void }) => JSX.Element> = {
  "/content": Content,
  "/boosts": Boosts,
  "/competitors": Competitors,
  "/rank": Rank,
  "/seo": Seo,
  "/reputation": Reputation,
  "/analytics": Analytics,
  "/org": Org,
  "/branding": Branding,
  "/queue": ActionQueue,
  "/credentials": Credentials,
};

export function App() {
  const route = useHashRoute();
  const [loaded, setLoaded] = useState(Boolean(state.apiKey && state.businessId));
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");

  if (!loaded) {
    return <Login onLoaded={() => setLoaded(true)} />;
  }

  function switchBusiness() {
    clearSession();
    setLoaded(false);
    setError("");
    navigate("/");
  }

  const Page = PAGES[route] ?? Dashboard;

  return (
    <div>
      <header>
        <h1>Connect</h1>
        <div className="auth-bar">
          <span>Viewing: {businessName || "this business"}</span>
          <button onClick={switchBusiness}>Switch business</button>
        </div>
      </header>
      <Nav active={route} />
      <main>
        <ErrorBanner message={error} />
        {route === "/" || !PAGES[route] ? (
          <Dashboard onError={setError} onLoaded={setBusinessName} />
        ) : (
          <Page onError={setError} />
        )}
      </main>
    </div>
  );
}
