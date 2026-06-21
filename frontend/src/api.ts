/** Resolves API calls relative to wherever this dashboard is actually served
 * from (e.g. https://host/api/) instead of hardcoding root-relative paths,
 * which break the moment the dashboard is deployed behind a reverse proxy
 * that maps a subpath (like /api/) to this service. */
const BASE_PATH = new URL(".", window.location.href).href;

export const state = {
  apiKey: localStorage.getItem("connect_api_key") || "",
  businessId: localStorage.getItem("connect_business_id") || "",
};

export function setApiKey(value: string): void {
  state.apiKey = value;
  localStorage.setItem("connect_api_key", value);
}

export function setBusinessId(value: string): void {
  state.businessId = value;
  localStorage.setItem("connect_business_id", value);
}

export function clearSession(): void {
  state.apiKey = "";
  state.businessId = "";
  localStorage.removeItem("connect_api_key");
  localStorage.removeItem("connect_business_id");
}

export interface ToolResult<T = unknown> {
  status: string;
  output: T;
  [key: string]: unknown;
}

export async function callTool<T = unknown>(
  name: string,
  input: Record<string, unknown> = {},
  dryRun = false
): Promise<ToolResult<T>> {
  const res = await fetch(new URL(`tools/${name}`, BASE_PATH), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.apiKey}`,
    },
    body: JSON.stringify({ businessId: state.businessId, dryRun, ...input }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      res.status === 401
        ? "Invalid API key — check it matches the server's configured key."
        : body?.diagnosis?.reason || body?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as ToolResult<T>;
}

export async function getCredentialFields(platform: string): Promise<string[]> {
  const res = await fetch(new URL(`platforms/${platform}/credential-fields`, BASE_PATH), {
    headers: { Authorization: `Bearer ${state.apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body.fields as string[];
}

export async function apiFetch<T = any>(
  path: string,
  opts: { method?: string; apiKey?: string; body?: unknown } = {}
): Promise<T> {
  const { method = "GET", apiKey = state.apiKey, body } = opts;
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(new URL(path, BASE_PATH), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(responseBody?.error || `Request failed (${res.status})`);
  return responseBody as T;
}
