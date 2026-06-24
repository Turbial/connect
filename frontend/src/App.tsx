import { useState } from "react";
import { useHashRoute, navigate, currentPath, navigateWithParam } from "./router";
import { clearSession, state } from "./api";
import { Nav } from "./components/Nav";
import { ErrorBanner } from "./components/ErrorBanner";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Content } from "./pages/Content";
import { Growth } from "./pages/Growth";
import { Reputation } from "./pages/Reputation";
import { Analytics } from "./pages/Analytics";
import { Platforms } from "./pages/Platforms";
import { Settings } from "./pages/Settings";
import { Billing } from "./pages/Billing";
import { Support } from "./pages/Support";
import { Inbox } from "./pages/Inbox";

const PAGES: Record<string, (props: { onError: (msg: string) => void }) => JSX.Element> = {
  "/inbox": Inbox,
  "/content": Content,
  "/growth": Growth,
  "/reputation": Reputation,
  "/revenue": Analytics,
  "/platforms": Platforms,
  "/settings": Settings,
  "/billing": Billing,
  "/support": Support,
};

/** Old flat routes -> [new top-level route, default tab]. Keeps every link
 * that used to work from 404ing — they now land on the equivalent tab of
 * the new grouped IA instead. */
const REDIRECTS: Record<string, [string, string]> = {
  "/boosts": ["/growth", "boosts"],
  "/competitors": ["/growth", "competitors"],
  "/rank": ["/growth", "local-seo"],
  "/seo": ["/growth", "local-seo"],
  "/analytics": ["/revenue", ""],
  "/org": ["/settings", "org"],
  "/branding": ["/settings", "branding"],
  "/queue": ["/settings", "org"],
  "/credentials": ["/platforms", "credentials"],
};

export function App() {
  useHashRoute();
  const route = currentPath();
  const [loaded, setLoaded] = useState(Boolean(state.apiKey && state.businessId));
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");

  if (!loaded) {
    return <Login onLoaded={() => setLoaded(true)} />;
  }

  const redirect = REDIRECTS[route];
  if (redirect) {
    const [target, tab] = redirect;
    if (tab) {
      navigateWithParam(target, "tab", tab);
    } else {
      navigate(target);
    }
    return null;
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
