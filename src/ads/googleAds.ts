import type { AdCreative, Business } from "../types.js";

/**
 * Google Ads API campaign launch. The REST surface requires a developer
 * token + OAuth refresh token exchange per request, isolated here behind
 * launchGoogleCampaign() since exact customer/manager account wiring needs
 * to be confirmed once Google Ads API access (developer token approval) is
 * granted — see plan note that this has its own lead time, like the GBP API.
 */
const GOOGLE_ADS_API_BASE = "https://googleads.googleapis.com/v17";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface AdLaunchResult {
  campaignId: string;
}

async function getAccessToken(business: Business): Promise<string> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!clientId || !clientSecret || !business.google_ads_refresh_token) {
    throw new Error(`Business ${business.id} has no Google Ads OAuth credentials`);
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: business.google_ads_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth token refresh failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function launchGoogleCampaign(business: Business, creative: AdCreative, budgetCents: number): Promise<AdLaunchResult> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken || !business.google_ads_customer_id) {
    throw new Error(`Business ${business.id} has no Google Ads account connected`);
  }

  const accessToken = await getAccessToken(business);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
  };

  const budgetRes = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${business.google_ads_customer_id}/campaignBudgets:mutate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [
          {
            create: {
              name: `${business.name} boost budget ${Date.now()}`,
              amountMicros: budgetCents * 10_000,
              deliveryMethod: "STANDARD",
            },
          },
        ],
      }),
    }
  );
  if (!budgetRes.ok) throw new Error(`Google Ads budget creation failed: ${budgetRes.status}`);
  const budgetData = (await budgetRes.json()) as { results: { resourceName: string }[] };

  const campaignRes = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${business.google_ads_customer_id}/campaigns:mutate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [
          {
            create: {
              name: `${business.name} boost ${Date.now()}`,
              advertisingChannelType: "LOCAL",
              status: "PAUSED",
              campaignBudget: budgetData.results[0].resourceName,
            },
          },
        ],
      }),
    }
  );
  if (!campaignRes.ok) throw new Error(`Google Ads campaign creation failed: ${campaignRes.status}`);
  const campaignData = (await campaignRes.json()) as { results: { resourceName: string }[] };

  return { campaignId: campaignData.results[0].resourceName };
}
