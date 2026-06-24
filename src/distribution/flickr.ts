import { safeFetch } from "../lib/safeFetch.js";
import type { Business, ContentItem } from "../types.js";

/**
 * Flickr API. Uploads via flickr.photos.upload (REST, multipart), then polls
 * real view counts via flickr.photos.getInfo. Flickr calls its app
 * credential pair "consumer key/secret" rather than client id/secret.
 */
const FLICKR_UPLOAD_URL = "https://up.flickr.com/services/upload/";
const FLICKR_REST_URL = "https://api.flickr.com/services/rest/";

export interface FlickrPostResult {
  platformPostId: string;
}

export async function postToFlickr(business: Business, item: ContentItem): Promise<FlickrPostResult> {
  if (!business.flickr_user_id || !business.flickr_access_token) {
    throw new Error(`Business ${business.id} is not connected to Flickr`);
  }
  if (!item.media_url) {
    throw new Error(`Flickr requires a photo; content item ${item.id} has none`);
  }

  const imageRes = await safeFetch(item.media_url);
  if (!imageRes.ok) throw new Error(`Failed to fetch media for upload: ${imageRes.status}`);
  const imageBuffer = await imageRes.arrayBuffer();

  const form = new FormData();
  form.append("photo", new Blob([imageBuffer]));
  form.append("title", item.caption.slice(0, 100));
  form.append("description", item.caption);

  const res = await fetch(FLICKR_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${business.flickr_access_token}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Flickr upload failed for business ${business.id}: ${res.status}`);
  }

  const xml = await res.text();
  const match = xml.match(/<photoid>(\d+)<\/photoid>/);
  if (!match) throw new Error(`Flickr upload returned no photo id for business ${business.id}`);
  return { platformPostId: match[1] };
}

interface FlickrInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchFlickrInsights(business: Business, platformPostId: string): Promise<FlickrInsight> {
  if (!business.flickr_access_token) {
    throw new Error(`Business ${business.id} has no Flickr access token`);
  }

  const params = new URLSearchParams({
    method: "flickr.photos.getInfo",
    photo_id: platformPostId,
    format: "json",
    nojsoncallback: "1",
  });

  const res = await fetch(`${FLICKR_REST_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${business.flickr_access_token}` },
  });
  if (!res.ok) {
    throw new Error(`Flickr insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as {
    photo?: { views?: string; comments?: { _content?: string } };
  };
  return {
    views: Number(data.photo?.views ?? 0),
    clicks: 0,
    engagement: Number(data.photo?.comments?._content ?? 0),
  };
}
