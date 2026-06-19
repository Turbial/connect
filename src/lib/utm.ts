/** Phase 3.1: appends standard UTM params to a business's destination URL, so
 * every link Connect generates can be tied back to the post/campaign that
 * drove the click in analytics/CRM tooling on the other end. */
export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

export function buildUtmLink(baseUrl: string, params: UtmParams): string {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", params.source);
  url.searchParams.set("utm_medium", params.medium);
  url.searchParams.set("utm_campaign", params.campaign);
  if (params.content) url.searchParams.set("utm_content", params.content);
  return url.toString();
}
