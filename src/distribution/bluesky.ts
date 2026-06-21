import type { Business, ContentItem } from "../types.js";

/**
 * Bluesky's AT Protocol. Auth is a session token obtained via app password
 * (createSession) rather than OAuth, since Bluesky's OAuth flow for third
 * party apps was still rolling out at the time this adapter was written —
 * confirm whether migrating to OAuth is worthwhile once it's stable.
 */
const BLUESKY_API_BASE = "https://bsky.social/xrpc";

export interface BlueskyPostResult {
  platformPostId: string;
}

async function createSession(business: Business): Promise<{ accessJwt: string; did: string }> {
  if (!business.bluesky_handle || !business.bluesky_app_password) {
    throw new Error(`Business ${business.id} is not connected to Bluesky`);
  }

  const res = await fetch(`${BLUESKY_API_BASE}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: business.bluesky_handle, password: business.bluesky_app_password }),
  });
  if (!res.ok) throw new Error(`Bluesky session creation failed for business ${business.id}: ${res.status}`);

  const data = (await res.json()) as { accessJwt: string; did: string };
  return data;
}

export async function postToBluesky(business: Business, item: ContentItem): Promise<BlueskyPostResult> {
  const session = await createSession(business);

  const res = await fetch(`${BLUESKY_API_BASE}/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        text: item.caption,
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Bluesky post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { uri: string };
  return { platformPostId: data.uri };
}

interface BlueskyInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchBlueskyInsights(business: Business, platformPostId: string): Promise<BlueskyInsight> {
  const session = await createSession(business);

  const res = await fetch(
    `${BLUESKY_API_BASE}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(platformPostId)}`,
    { headers: { Authorization: `Bearer ${session.accessJwt}` } }
  );
  if (!res.ok) {
    throw new Error(`Bluesky insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as {
    thread?: { post?: { likeCount?: number; repostCount?: number; replyCount?: number } };
  };
  const post = data.thread?.post ?? {};
  return {
    views: 0,
    clicks: 0,
    engagement: (post.likeCount ?? 0) + (post.repostCount ?? 0) + (post.replyCount ?? 0),
  };
}
