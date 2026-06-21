import type { Business, ContentItem } from "../types.js";

/**
 * LinkedIn Marketing/Posts API. Image posts require registering an upload,
 * PUTting the binary to the returned URL, then referencing the resulting
 * asset URN in the post body.
 */
const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";

export interface LinkedinPostResult {
  platformPostId: string;
}

async function uploadImage(business: Business, mediaUrl: string, authorUrn: string): Promise<string> {
  const registerRes = await fetch(`${LINKEDIN_API_BASE}/assets?action=registerUpload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.linkedin_access_token}`,
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: authorUrn,
        serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
      },
    }),
  });
  if (!registerRes.ok) throw new Error(`LinkedIn upload registration failed for business ${business.id}: ${registerRes.status}`);

  const register = (await registerRes.json()) as {
    value: { uploadMechanism: { "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": { uploadUrl: string } }; asset: string };
  };
  const uploadUrl = register.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;

  const imageRes = await fetch(mediaUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch media for upload: ${imageRes.status}`);
  const imageBuffer = await imageRes.arrayBuffer();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${business.linkedin_access_token}` },
    body: imageBuffer,
  });
  if (!putRes.ok) throw new Error(`LinkedIn image upload failed for business ${business.id}: ${putRes.status}`);

  return register.value.asset;
}

export async function postToLinkedin(business: Business, item: ContentItem): Promise<LinkedinPostResult> {
  if (!business.linkedin_organization_id || !business.linkedin_access_token) {
    throw new Error(`Business ${business.id} is not connected to a LinkedIn organization page`);
  }

  const authorUrn = `urn:li:organization:${business.linkedin_organization_id}`;
  const asset = item.media_url ? await uploadImage(business, item.media_url, authorUrn) : null;

  const res = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${business.linkedin_access_token}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: item.caption },
          shareMediaCategory: asset ? "IMAGE" : "NONE",
          ...(asset ? { media: [{ status: "READY", media: asset }] } : {}),
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!res.ok) {
    throw new Error(`LinkedIn post failed for business ${business.id}: ${res.status}`);
  }

  const platformPostId = res.headers.get("x-restli-id") ?? "";
  return { platformPostId };
}

interface LinkedinInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchLinkedinInsights(business: Business, platformPostId: string): Promise<LinkedinInsight> {
  if (!business.linkedin_access_token) {
    throw new Error(`Business ${business.id} has no LinkedIn access token`);
  }

  const res = await fetch(
    `${LINKEDIN_API_BASE}/organizationalEntityShareStatistics?q=organizationalEntity&shares=${encodeURIComponent(platformPostId)}`,
    { headers: { Authorization: `Bearer ${business.linkedin_access_token}` } }
  );
  if (!res.ok) {
    throw new Error(`LinkedIn insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as {
    elements?: { totalShareStatistics?: { impressionCount?: number; clickCount?: number; engagement?: number } }[];
  };
  const stats = data.elements?.[0]?.totalShareStatistics ?? {};
  return {
    views: stats.impressionCount ?? 0,
    clicks: stats.clickCount ?? 0,
    engagement: stats.engagement ?? 0,
  };
}
