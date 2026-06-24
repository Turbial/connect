/**
 * OAuth flow helpers for platform connections.
 *
 * Each platform needs its own client ID/secret in env vars. The redirect URI
 * must be registered in the platform's developer console and match exactly:
 *   {CONNECT_BASE_URL}/oauth/callback/{platform}
 *
 * Required env vars by platform:
 *   Google/GBP: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CONNECT_BASE_URL
 *   Facebook/Instagram: FB_APP_ID, FB_APP_SECRET, CONNECT_BASE_URL
 */

export type OAuthPlatform = "google" | "facebook" | "instagram";

interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

const CONFIGS: Record<OAuthPlatform, OAuthConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/business.manage",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  facebook: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scope: "pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish",
    clientIdEnv: "FB_APP_ID",
    clientSecretEnv: "FB_APP_SECRET",
  },
  instagram: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scope: "instagram_basic,instagram_content_publish,pages_show_list",
    clientIdEnv: "FB_APP_ID",
    clientSecretEnv: "FB_APP_SECRET",
  },
};

export function buildOAuthUrl(platform: OAuthPlatform, state: string): string {
  const cfg = CONFIGS[platform];
  const clientId = process.env[cfg.clientIdEnv];
  const baseUrl = process.env.CONNECT_BASE_URL;
  if (!clientId) throw new Error(`${cfg.clientIdEnv} env var is not set`);
  if (!baseUrl) throw new Error("CONNECT_BASE_URL env var is not set");

  const redirectUri = `${baseUrl}/oauth/callback/${platform}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: cfg.scope,
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${cfg.authUrl}?${params}`;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
}

export async function exchangeCodeForTokens(platform: OAuthPlatform, code: string): Promise<OAuthTokens> {
  const cfg = CONFIGS[platform];
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  const baseUrl = process.env.CONNECT_BASE_URL;
  if (!clientId || !clientSecret) throw new Error(`${cfg.clientIdEnv}/${cfg.clientSecretEnv} env vars are not set`);
  if (!baseUrl) throw new Error("CONNECT_BASE_URL env var is not set");

  const redirectUri = `${baseUrl}/oauth/callback/${platform}`;
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth token exchange failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string };
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null };
}

/** Map from OAuth platform to the business-table column(s) to write. */
export function tokenColumnsFor(platform: OAuthPlatform): { accessToken: string; refreshToken?: string } {
  if (platform === "google") return { accessToken: "gbp_access_token", refreshToken: "gbp_refresh_token" };
  if (platform === "facebook") return { accessToken: "fb_page_access_token" };
  return { accessToken: "fb_page_access_token" };
}
