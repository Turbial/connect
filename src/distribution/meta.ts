import type { Business, ContentItem } from "../types.js";

/**
 * Meta Graph API for organic Page/Instagram posting. Photo posts on Facebook
 * Pages and Instagram Business accounts both follow the same two-step pattern
 * (publish a photo node, no separate "publish" step needed for single-image
 * posts), so one function handles both — the caller picks the target id.
 */
const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaPostResult {
  platformPostId: string;
}

export async function postToFacebookPage(business: Business, item: ContentItem): Promise<MetaPostResult> {
  if (!business.fb_page_id || !business.fb_page_access_token) {
    throw new Error(`Business ${business.id} is not connected to a Facebook Page`);
  }

  const endpoint = item.media_url
    ? `${GRAPH_BASE}/${business.fb_page_id}/photos`
    : `${GRAPH_BASE}/${business.fb_page_id}/feed`;

  const params = new URLSearchParams({
    access_token: business.fb_page_access_token,
    ...(item.media_url ? { url: item.media_url, caption: item.caption } : { message: item.caption }),
  });

  const res = await fetch(endpoint, { method: "POST", body: params });
  if (!res.ok) {
    throw new Error(`Facebook post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { post_id?: string; id: string };
  return { platformPostId: data.post_id ?? data.id };
}

/** Polls an Instagram Reels container until Meta finishes processing the uploaded
 * video server-side; publishing before it's FINISHED returns an error. */
async function waitForContainerReady(accessToken: string, containerId: string): Promise<void> {
  const maxAttempts = 10;
  const delayMs = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`);
    if (!res.ok) {
      throw new Error(`Instagram container status check failed: ${res.status}`);
    }
    const data = (await res.json()) as { status_code?: string };
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error(`Instagram container ${containerId} failed processing`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Instagram container ${containerId} did not finish processing in time`);
}

export async function postToInstagram(business: Business, item: ContentItem): Promise<MetaPostResult> {
  if (!business.ig_business_id || !business.fb_page_access_token) {
    throw new Error(`Business ${business.id} is not connected to an Instagram Business account`);
  }
  if (!item.media_url) {
    throw new Error(`Instagram posts require an image or video; content item ${item.id} has none`);
  }

  // Instagram publishing is two steps: create a media container, then publish it.
  // Reels (video) containers take a moment to process the video server-side before
  // they're publishable, unlike image containers which are ready immediately.
  const isVideo = item.media_type === "video";
  const containerParams = new URLSearchParams({
    access_token: business.fb_page_access_token,
    caption: item.caption,
    ...(isVideo
      ? { media_type: "REELS", video_url: item.media_url }
      : { image_url: item.media_url }),
  });
  const containerRes = await fetch(`${GRAPH_BASE}/${business.ig_business_id}/media`, {
    method: "POST",
    body: containerParams,
  });
  if (!containerRes.ok) {
    throw new Error(`Instagram media container failed for business ${business.id}: ${containerRes.status}`);
  }
  const container = (await containerRes.json()) as { id: string };

  if (isVideo) {
    await waitForContainerReady(business.fb_page_access_token, container.id);
  }

  const publishParams = new URLSearchParams({
    access_token: business.fb_page_access_token,
    creation_id: container.id,
  });
  const publishRes = await fetch(`${GRAPH_BASE}/${business.ig_business_id}/media_publish`, {
    method: "POST",
    body: publishParams,
  });
  if (!publishRes.ok) {
    throw new Error(`Instagram publish failed for business ${business.id}: ${publishRes.status}`);
  }
  const published = (await publishRes.json()) as { id: string };
  return { platformPostId: published.id };
}

interface MetaInsight {
  views: number;
  clicks: number;
  engagement: number;
}

/** Pulls reach/engagement for a Page or Instagram media post. Insight field names differ slightly
 * between surfaces, but both expose them as the `insights` edge on the object id. */
export async function fetchMetaInsights(business: Business, platformPostId: string): Promise<MetaInsight> {
  if (!business.fb_page_access_token) {
    throw new Error(`Business ${business.id} has no Meta access token`);
  }

  const res = await fetch(
    `${GRAPH_BASE}/${platformPostId}/insights?metric=post_impressions,post_clicks,post_engaged_users&access_token=${business.fb_page_access_token}`
  );
  if (!res.ok) {
    throw new Error(`Meta insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as { data?: { name: string; values: { value: number }[] }[] };
  const metric = (name: string) => data.data?.find((m) => m.name === name)?.values[0]?.value ?? 0;

  return {
    views: metric("post_impressions"),
    clicks: metric("post_clicks"),
    engagement: metric("post_engaged_users"),
  };
}
