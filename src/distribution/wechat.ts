import type { Business, ContentItem } from "../types.js";

/**
 * WeChat Official Account API. Publishes a draft then immediately submits it
 * via the freepublish endpoint, per the documented two-step publish flow.
 */
const WECHAT_API_BASE = "https://api.weixin.qq.com/cgi-bin";

export interface WechatPostResult {
  platformPostId: string;
}

export async function postToWechat(business: Business, item: ContentItem): Promise<WechatPostResult> {
  if (!business.wechat_official_account_id || !business.wechat_access_token) {
    throw new Error(`Business ${business.id} is not connected to WeChat`);
  }

  const draftRes = await fetch(`${WECHAT_API_BASE}/draft/add?access_token=${business.wechat_access_token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articles: [
        {
          title: item.caption.slice(0, 64),
          content: item.caption,
          ...(item.media_url ? { thumb_media_id: item.media_url } : {}),
        },
      ],
    }),
  });
  if (!draftRes.ok) throw new Error(`WeChat draft creation failed for business ${business.id}: ${draftRes.status}`);
  const draftData = (await draftRes.json()) as { media_id?: string; errcode?: number };
  if (!draftData.media_id) throw new Error(`WeChat draft returned no media_id for business ${business.id} (errcode ${draftData.errcode})`);

  const publishRes = await fetch(`${WECHAT_API_BASE}/freepublish/submit?access_token=${business.wechat_access_token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_id: draftData.media_id }),
  });
  if (!publishRes.ok) throw new Error(`WeChat publish failed for business ${business.id}: ${publishRes.status}`);
  const publishData = (await publishRes.json()) as { publish_id?: string; errcode?: number };
  if (!publishData.publish_id) throw new Error(`WeChat publish returned no publish_id for business ${business.id} (errcode ${publishData.errcode})`);

  return { platformPostId: publishData.publish_id };
}

interface WechatInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export async function fetchWechatInsights(business: Business, platformPostId: string): Promise<WechatInsight> {
  if (!business.wechat_access_token) {
    throw new Error(`Business ${business.id} has no WeChat access token`);
  }

  const res = await fetch(`${WECHAT_API_BASE}/freepublish/get?access_token=${business.wechat_access_token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publish_id: platformPostId }),
  });
  if (!res.ok) {
    throw new Error(`WeChat insights fetch failed for ${platformPostId}: ${res.status}`);
  }

  const data = (await res.json()) as { article_detail?: { item?: { article_url?: string } }[] };
  return {
    views: 0,
    clicks: data.article_detail ? 1 : 0,
    engagement: 0,
  };
}
