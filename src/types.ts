export interface Business {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  gbp_location_id: string | null;
  gbp_access_token: string | null;
  gbp_refresh_token: string | null;
}

export type ContentStatus = "queued" | "approved" | "posted" | "rejected" | "edited";

export interface ContentItem {
  id: string;
  business_id: string;
  source: "content_engine" | "manual";
  caption: string;
  media_url: string | null;
  platforms: string[];
  status: ContentStatus;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  content_item_id: string;
  channel: "sms" | "email";
  sent_at: string;
  response: string | null;
  responded_at: string | null;
  timeout_action: "auto_post" | "hold";
}

export interface Post {
  id: string;
  content_item_id: string;
  platform: string;
  platform_post_id: string | null;
  posted_at: string | null;
  views: number;
  clicks: number;
  calls: number;
  last_polled_at: string | null;
}

export interface GeneratedPost {
  caption: string;
  mediaUrl: string | null;
}
