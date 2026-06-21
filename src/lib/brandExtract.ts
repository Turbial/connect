/** Pulls colors/fonts/images off an existing business website to seed
 * Report Branding, via the vendored @turbial/web-components package
 * (see package.json — pinned to a specific commit, not resolved live).
 *
 * The module specifier is kept in a variable rather than a literal import
 * so this file still type-checks before the dependency has actually been
 * installed; once `npm install` picks it up, this starts working with no
 * code change needed.
 */
const EXTRACT_MODULE_SPECIFIER = "@turbial/web-components/lib/extract.mjs";

export interface ExtractedBrand {
  sourceUrl: string;
  title: string | null;
  colors: Record<string, string>;
  fonts: string[];
  images: string[];
  extractedAt: string;
}

function assertHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported");
  }
  return url;
}

export async function extractBrandFromUrl(rawUrl: string): Promise<ExtractedBrand> {
  const url = assertHttpUrl(rawUrl);

  let extractPage: (url: string, opts?: { maxBlocks?: number; maxImages?: number }) => Promise<any>;
  try {
    const mod: any = await import(EXTRACT_MODULE_SPECIFIER);
    extractPage = mod.extractPage;
  } catch {
    throw new Error(
      "Brand extraction isn't installed yet — run `npm install` to pick up @turbial/web-components, " +
        "pinned in package.json.",
    );
  }

  const result = await extractPage(url.toString(), { maxBlocks: 10, maxImages: 6 });

  const images = [result.ogImage, result.hero?.src, ...(result.images ?? []).map((i: any) => i.src)].filter(
    (src): src is string => Boolean(src),
  );

  return {
    sourceUrl: url.toString(),
    title: result.title ?? null,
    colors: result.colors ?? {},
    fonts: result.webFonts ?? [],
    images: Array.from(new Set(images)).slice(0, 6),
    extractedAt: result.extractedAt ?? new Date().toISOString(),
  };
}
