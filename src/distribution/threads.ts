import type { Business, ContentItem } from "../types.js";

/**
 * Threads API (Meta) — same two-step container/publish pattern as Instagram,
 * but against the threads.net host and the business's Threads-scoped token
 * rather than the IG Graph token, since the two are issued separately.
 */
const THREADS_API_BASE = "https://graph.threads.net/v1.0";

export interface ThreadsPostResult {
  platformPostId: string;
}

export async function postToThreads(business: Business, item: ContentItem): Promise<ThreadsPostResult> {
  if (!business.threads_user_id || !business.threads_access_token) {
    throw new Error(`Business ${business.id} is not connected to Threads`);
  }

  const containerParams = new URLSearchParams({
    access_token: business.threads_access_token,
    media_type: item.media_url ? "IMAGE" : "TEXT",
    text: item.caption,
    ...(item.media_url ? { image_url: item.media_url } : {}),
  });
  const containerRes = await fetch(`${THREADS_API_BASE}/${business.threads_user_id}/threads`, {
    method: "POST",
    body: containerParams,
  });
  if (!containerRes.ok) {
    throw new Error(`Threads media container failed for business ${business.id}: ${containerRes.status}`);
  }
  const container = (await containerRes.json()) as { id: string };

  const publishParams = new URLSearchParams({
    access_token: business.threads_access_token,
    creation_id: container.id,
  });
  const publishRes = await fetch(`${THREADS_API_BASE}/${business.threads_user_id}/threads_publish`, {
    method: "POST",
    body: publishParams,
  });
  if (!publishRes.ok) {
    throw new Error(`Threads publish failed for business ${business.id}: ${publishRes.status}`);
  }
  const published = (await publishRes.json()) as { id: string };
  return { platformPostId: published.id };
}

interface ThreadsInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchThreadsInsights(business: Business, platformPostId: string): Promise<ThreadsInsight> {
  if (!business.threads_access_token) {
    throw new Error(`Business ${business.id} has no Threads access token`);
  }

  const res = await fetch(
    `${THREADS_API_BASE}/${platformPostId}/insights?metric=views,likes,replies&access_token=${business.threads_access_token}`
  );
  if (!res.ok) {
    throw new Error(`Threads insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as { data?: { name: string; values: { value: number }[] }[] };
  const metric = (name: string) => data.data?.find((m) => m.name === name)?.values[0]?.value ?? 0;

  return {
    views: metric("views"),
    clicks: 0,
    engagement: metric("likes") + metric("replies"),
  };
}
