import type { Business, ContentItem } from "../types.js";

/**
 * YouTube Data API v3 resumable upload for Shorts. The Content Engine's
 * fal.ai videos are vertical/short already, so no extra "Shorts" flag is
 * needed beyond the video's own aspect ratio/duration. Uses the same OAuth
 * refresh-token exchange pattern as src/ads/googleAds.ts.
 */
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const DATA_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YoutubePostResult {
  platformPostId: string;
}

async function getAccessToken(business: Business): Promise<string> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !business.youtube_refresh_token) {
    throw new Error(`Business ${business.id} has no YouTube OAuth credentials`);
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: business.youtube_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth token refresh failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function postToYoutube(business: Business, item: ContentItem): Promise<YoutubePostResult> {
  if (!business.youtube_channel_id) {
    throw new Error(`Business ${business.id} is not connected to YouTube`);
  }
  if (!item.media_url) {
    throw new Error(`YouTube Shorts require a video; content item ${item.id} has none`);
  }

  const accessToken = await getAccessToken(business);

  const initRes = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Upload-Content-Type": "video/mp4",
    },
    body: JSON.stringify({
      snippet: {
        title: item.caption.slice(0, 100),
        description: item.caption,
      },
      status: { privacyStatus: "public" },
    }),
  });
  if (!initRes.ok) throw new Error(`YouTube upload init failed for business ${business.id}: ${initRes.status}`);

  const uploadSessionUrl = initRes.headers.get("location");
  if (!uploadSessionUrl) throw new Error(`YouTube upload init returned no session url for business ${business.id}`);

  const videoRes = await fetch(item.media_url);
  if (!videoRes.ok) throw new Error(`Failed to fetch video for upload: ${videoRes.status}`);
  const videoBuffer = await videoRes.arrayBuffer();

  const uploadRes = await fetch(uploadSessionUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body: videoBuffer,
  });
  if (!uploadRes.ok) throw new Error(`YouTube video upload failed for business ${business.id}: ${uploadRes.status}`);

  const data = (await uploadRes.json()) as { id: string };
  return { platformPostId: data.id };
}

interface YoutubeInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchYoutubeInsights(business: Business, platformPostId: string): Promise<YoutubeInsight> {
  const accessToken = await getAccessToken(business);

  const res = await fetch(`${DATA_API_BASE}/videos?part=statistics&id=${platformPostId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`YouTube insights fetch failed for ${platformPostId}: ${res.status}`);

  const data = (await res.json()) as {
    items?: { statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[];
  };
  const stats = data.items?.[0]?.statistics ?? {};
  return {
    views: Number(stats.viewCount ?? 0),
    clicks: 0,
    engagement: Number(stats.likeCount ?? 0) + Number(stats.commentCount ?? 0),
  };
}
