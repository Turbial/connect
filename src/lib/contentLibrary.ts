import { supabase } from "./supabase.js";

export interface LibraryItem {
  id: string;
  organizationId: string;
  caption: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  platforms: string[];
  createdAt: string;
}

export async function listLibraryItems(organizationId: string): Promise<LibraryItem[]> {
  const { data, error } = await supabase
    .from("content_library_item")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    caption: row.caption as string,
    mediaUrl: row.media_url as string | null,
    mediaType: row.media_type as "image" | "video" | null,
    platforms: (row.platforms as string[]) ?? [],
    createdAt: row.created_at as string,
  }));
}

export async function addLibraryItem(
  organizationId: string,
  caption: string,
  platforms: string[],
  mediaUrl?: string | null,
  mediaType?: "image" | "video" | null,
): Promise<LibraryItem> {
  const { data, error } = await supabase
    .from("content_library_item")
    .insert({
      organization_id: organizationId,
      caption,
      platforms,
      media_url: mediaUrl ?? null,
      media_type: mediaType ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  const row = data as any;
  return {
    id: row.id,
    organizationId: row.organization_id,
    caption: row.caption,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    platforms: row.platforms ?? [],
    createdAt: row.created_at,
  };
}

export async function removeLibraryItem(organizationId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from("content_library_item")
    .delete()
    .eq("id", itemId)
    .eq("organization_id", organizationId);
  if (error) throw error;
}
