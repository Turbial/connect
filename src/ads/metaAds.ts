import type { AdCreative, Business } from "../types.js";

/**
 * Meta Marketing API campaign launch, isolated behind this adapter since the
 * exact ad account setup (objective, optimization goal, billing event) needs
 * to be confirmed against the live ad account once one exists. This targets
 * the documented v19+ Campaign/AdSet/Ad/AdCreative object chain for a basic
 * local-awareness boost.
 */
const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface AdLaunchResult {
  campaignId: string;
}

async function createObject(
  business: Business,
  edge: string,
  fields: Record<string, string>
): Promise<{ id: string }> {
  const params = new URLSearchParams({ access_token: business.fb_page_access_token ?? "", ...fields });
  const res = await fetch(`${GRAPH_BASE}/act_${business.meta_ads_account_id}/${edge}`, {
    method: "POST",
    body: params,
  });
  if (!res.ok) throw new Error(`Meta Ads ${edge} creation failed for business ${business.id}: ${res.status}`);
  return (await res.json()) as { id: string };
}

export async function launchMetaCampaign(business: Business, creative: AdCreative, budgetCents: number): Promise<AdLaunchResult> {
  if (!business.meta_ads_account_id || !business.fb_page_access_token) {
    throw new Error(`Business ${business.id} has no Meta Ads account connected`);
  }

  const campaign = await createObject(business, "campaigns", {
    name: `${business.name} boost ${new Date().toISOString()}`,
    objective: "OUTCOME_ENGAGEMENT",
    status: "PAUSED",
    special_ad_categories: "[]",
  });

  const adSet = await createObject(business, "adsets", {
    name: `${business.name} boost adset`,
    campaign_id: campaign.id,
    daily_budget: String(budgetCents),
    billing_event: "IMPRESSIONS",
    optimization_goal: "POST_ENGAGEMENT",
    targeting: JSON.stringify({
      geo_locations: business.location_lat && business.location_lng
        ? { custom_locations: [{ latitude: business.location_lat, longitude: business.location_lng, radius: 15, distance_unit: "mile" }] }
        : { countries: ["US"] },
    }),
    status: "PAUSED",
  });

  const adCreative = await createObject(business, "adcreatives", {
    name: `${business.name} boost creative`,
    object_story_spec: JSON.stringify({
      page_id: business.fb_page_id,
      link_data: { message: creative.copyVariants[0], picture: creative.imageUrls[0] },
    }),
  });

  await createObject(business, "ads", {
    name: `${business.name} boost ad`,
    adset_id: adSet.id,
    creative: JSON.stringify({ creative_id: adCreative.id }),
    status: "PAUSED",
  });

  return { campaignId: campaign.id };
}
