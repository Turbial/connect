import type { Business, ContentItem } from "../types.js";

/**
 * Mastodon's REST API. Mastodon is federated, so the API base is the
 * business's own instance URL rather than a single shared host.
 */
export interface MastodonPostResult {
  platformPostId: string;
}

export async function postToMastodon(business: Business, item: ContentItem): Promise<MastodonPostResult> {
  if (!business.mastodon_instance_url || !business.mastodon_access_token) {
    throw new Error(`Business ${business.id} is not connected to Mastodon`);
  }

  let mediaId: string | undefined;
  if (item.media_url) {
    const mediaRes = await fetch(item.media_url);
    if (!mediaRes.ok) throw new Error(`Failed to fetch media for upload: ${mediaRes.status}`);
    const mediaBuffer = await mediaRes.arrayBuffer();

    const form = new FormData();
    form.append("file", new Blob([mediaBuffer]));

    const uploadRes = await fetch(`${business.mastodon_instance_url}/api/v2/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${business.mastodon_access_token}` },
      body: form,
    });
    if (!uploadRes.ok) throw new Error(`Mastodon media upload failed for business ${business.id}: ${uploadRes.status}`);
    const uploadData = (await uploadRes.json()) as { id: string };
    mediaId = uploadData.id;
  }

  const res = await fetch(`${business.mastodon_instance_url}/api/v1/statuses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.mastodon_access_token}`,
    },
    body: JSON.stringify({
      status: item.caption,
      ...(mediaId ? { media_ids: [mediaId] } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Mastodon post failed for business ${business.id}: ${res.status}`);
  }

  const data = (await res.json()) as { id: string };
  return { platformPostId: data.id };
}

interface MastodonInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchMastodonInsights(business: Business, platformPostId: string): Promise<MastodonInsight> {
  if (!business.mastodon_instance_url || !business.mastodon_access_token) {
    throw new Error(`Business ${business.id} has no Mastodon credentials`);
  }

  const res = await fetch(`${business.mastodon_instance_url}/api/v1/statuses/${platformPostId}`, {
    headers: { Authorization: `Bearer ${business.mastodon_access_token}` },
  });
  if (!res.ok) {
    throw new Error(`Mastodon insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as { favourites_count?: number; reblogs_count?: number; replies_count?: number };
  return {
    views: 0,
    clicks: 0,
    engagement: (data.favourites_count ?? 0) + (data.reblogs_count ?? 0) + (data.replies_count ?? 0),
  };
}
