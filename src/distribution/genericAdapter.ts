import type { Business, ContentItem } from "../types.js";

/**
 * Phase 12 adds 72 new platforms with no bespoke API integration designed
 * yet (unlike gbp.ts/discord.ts/etc., each of which targets a confirmed or
 * inferred real endpoint). Rather than write 72 near-duplicate adapters
 * against unconfirmed endpoints, this factory produces a generic stub
 * adapter per platform: it validates the business is connected (same
 * `if (!business.<id>_field)` guard as every other adapter), then returns a
 * synthetic platformPostId without making a real network call, and reports
 * zero insights — same honest-zeros approach as fetchDiscordInsights, but
 * because there's no confirmed API at all rather than a confirmed API with
 * no analytics surface. Replace each with a real adapter as API access is
 * confirmed per platform (see README's Known gaps).
 */

export interface GenericPostResult {
  platformPostId: string;
}

interface GenericInsight {
  views: number;
  clicks: number;
  engagement: number;
}

export interface GenericAdapter {
  postTo: (business: Business, item: ContentItem) => Promise<GenericPostResult>;
  fetchInsights: (business: Business, platformPostId: string) => Promise<GenericInsight>;
}

export function createGenericAdapter(platformName: string, idField: string, tokenField: string): GenericAdapter {
  async function postTo(business: Business, _item: ContentItem): Promise<GenericPostResult> {
    const id = (business as unknown as Record<string, string | null>)[idField];
    const token = (business as unknown as Record<string, string | null>)[tokenField];
    if (!id || !token) {
      throw new Error(`Business ${business.id} is not connected to ${platformName}`);
    }
    return { platformPostId: `generic-${Date.now()}` };
  }

  async function fetchInsights(_business: Business, _platformPostId: string): Promise<GenericInsight> {
    return { views: 0, clicks: 0, engagement: 0 };
  }

  return { postTo, fetchInsights };
}

const REGISTRY: Record<string, { idField: string; tokenField: string }> = {
  weibo: { idField: "weibo_id", tokenField: "weibo_access_token" },
  xiaohongshu: { idField: "xiaohongshu_id", tokenField: "xiaohongshu_access_token" },
  kakaotalk: { idField: "kakaotalk_id", tokenField: "kakaotalk_access_token" },
  naver: { idField: "naver_id", tokenField: "naver_access_token" },
  baidu: { idField: "baidu_id", tokenField: "baidu_access_token" },
  douyin: { idField: "douyin_id", tokenField: "douyin_access_token" },
  kuaishou: { idField: "kuaishou_id", tokenField: "kuaishou_access_token" },
  weverse: { idField: "weverse_id", tokenField: "weverse_access_token" },
  signal: { idField: "signal_id", tokenField: "signal_access_token" },
  viber: { idField: "viber_id", tokenField: "viber_access_token" },
  kik: { idField: "kik_id", tokenField: "kik_access_token" },
  skype: { idField: "skype_id", tokenField: "skype_access_token" },
  slack: { idField: "slack_id", tokenField: "slack_access_token" },
  meetup: { idField: "meetup_id", tokenField: "meetup_access_token" },
  eventbrite: { idField: "eventbrite_id", tokenField: "eventbrite_access_token" },
  craigslist: { idField: "craigslist_id", tokenField: "craigslist_access_token" },
  indeed: { idField: "indeed_id", tokenField: "indeed_access_token" },
  glassdoor: { idField: "glassdoor_id", tokenField: "glassdoor_access_token" },
  capterra: { idField: "capterra_id", tokenField: "capterra_access_token" },
  g2: { idField: "g2_id", tokenField: "g2_access_token" },
  producthunt: { idField: "producthunt_id", tokenField: "producthunt_access_token" },
  behance: { idField: "behance_id", tokenField: "behance_access_token" },
  dribbble: { idField: "dribbble_id", tokenField: "dribbble_access_token" },
  deviantart: { idField: "deviantart_id", tokenField: "deviantart_access_token" },
  fivehundredpx: { idField: "fivehundredpx_id", tokenField: "fivehundredpx_access_token" },
  unsplash: { idField: "unsplash_id", tokenField: "unsplash_access_token" },
  soundcloud: { idField: "soundcloud_id", tokenField: "soundcloud_access_token" },
  spotify: { idField: "spotify_id", tokenField: "spotify_access_token" },
  applepodcasts: { idField: "applepodcasts_id", tokenField: "applepodcasts_access_token" },
  googlepodcasts: { idField: "googlepodcasts_id", tokenField: "googlepodcasts_access_token" },
  anchor: { idField: "anchor_id", tokenField: "anchor_access_token" },
  substack: { idField: "substack_id", tokenField: "substack_access_token" },
  ghost: { idField: "ghost_id", tokenField: "ghost_access_token" },
  wordpress: { idField: "wordpress_id", tokenField: "wordpress_access_token" },
  blogger: { idField: "blogger_id", tokenField: "blogger_access_token" },
  weebly: { idField: "weebly_id", tokenField: "weebly_access_token" },
  wix: { idField: "wix_id", tokenField: "wix_access_token" },
  squarespace: { idField: "squarespace_id", tokenField: "squarespace_access_token" },
  etsy: { idField: "etsy_id", tokenField: "etsy_access_token" },
  amazon: { idField: "amazon_id", tokenField: "amazon_access_token" },
  shopify: { idField: "shopify_id", tokenField: "shopify_access_token" },
  walmart: { idField: "walmart_id", tokenField: "walmart_access_token" },
  target: { idField: "target_id", tokenField: "target_access_token" },
  instacart: { idField: "instacart_id", tokenField: "instacart_access_token" },
  doordash: { idField: "doordash_id", tokenField: "doordash_access_token" },
  ubereats: { idField: "ubereats_id", tokenField: "ubereats_access_token" },
  grubhub: { idField: "grubhub_id", tokenField: "grubhub_access_token" },
  postmates: { idField: "postmates_id", tokenField: "postmates_access_token" },
  zomato: { idField: "zomato_id", tokenField: "zomato_access_token" },
  swiggy: { idField: "swiggy_id", tokenField: "swiggy_access_token" },
  justeat: { idField: "justeat_id", tokenField: "justeat_access_token" },
  deliveroo: { idField: "deliveroo_id", tokenField: "deliveroo_access_token" },
  booking: { idField: "booking_id", tokenField: "booking_access_token" },
  expedia: { idField: "expedia_id", tokenField: "expedia_access_token" },
  airbnb: { idField: "airbnb_id", tokenField: "airbnb_access_token" },
  vrbo: { idField: "vrbo_id", tokenField: "vrbo_access_token" },
  hotelscom: { idField: "hotelscom_id", tokenField: "hotelscom_access_token" },
  kayak: { idField: "kayak_id", tokenField: "kayak_access_token" },
  agoda: { idField: "agoda_id", tokenField: "agoda_access_token" },
  trivago: { idField: "trivago_id", tokenField: "trivago_access_token" },
  hostelworld: { idField: "hostelworld_id", tokenField: "hostelworld_access_token" },
  couchsurfing: { idField: "couchsurfing_id", tokenField: "couchsurfing_access_token" },
  meituan: { idField: "meituan_id", tokenField: "meituan_access_token" },
  dianping: { idField: "dianping_id", tokenField: "dianping_access_token" },
  gaode: { idField: "gaode_id", tokenField: "gaode_access_token" },
  here: { idField: "here_id", tokenField: "here_access_token" },
  mapquest: { idField: "mapquest_id", tokenField: "mapquest_access_token" },
  waze: { idField: "waze_id", tokenField: "waze_access_token" },
  alibaba: { idField: "alibaba_id", tokenField: "alibaba_access_token" },
  tmall: { idField: "tmall_id", tokenField: "tmall_access_token" },
  ebay: { idField: "ebay_id", tokenField: "ebay_access_token" },
  naverblog: { idField: "naverblog_id", tokenField: "naverblog_access_token" },
  shopee: { idField: "shopee_id", tokenField: "shopee_access_token" },
  lazada: { idField: "lazada_id", tokenField: "lazada_access_token" },
  mercadolibre: { idField: "mercadolibre_id", tokenField: "mercadolibre_access_token" },
  rakuten: { idField: "rakuten_id", tokenField: "rakuten_access_token" },
  aliexpress: { idField: "aliexpress_id", tokenField: "aliexpress_access_token" },
  wish: { idField: "wish_id", tokenField: "wish_access_token" },
  depop: { idField: "depop_id", tokenField: "depop_access_token" },
  poshmark: { idField: "poshmark_id", tokenField: "poshmark_access_token" },
  vinted: { idField: "vinted_id", tokenField: "vinted_access_token" },
  snapdeal: { idField: "snapdeal_id", tokenField: "snapdeal_access_token" },
};

/** One generic stub adapter per Phase 12 platform, keyed by platform name. */
export const genericAdapters: Record<string, GenericAdapter> = Object.fromEntries(
  Object.entries(REGISTRY).map(([platform, { idField, tokenField }]) => [
    platform,
    createGenericAdapter(platform, idField, tokenField),
  ])
);
