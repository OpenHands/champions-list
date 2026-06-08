import { getContributorDirectoryData } from "@/lib/contributors";

export const runtime = "nodejs";

function clampInt(value: string | null, min: number, max: number, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function withAvatarSize(avatarUrl: string, size: number): string {
  try {
    const url = new URL(avatarUrl);
    url.searchParams.set("s", String(size));
    return url.toString();
  } catch {
    return avatarUrl;
  }
}

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const size = clampInt(requestUrl.searchParams.get("size"), 12, 48, 24);
  const gap = clampInt(requestUrl.searchParams.get("gap"), 0, 12, 2);
  const maxColumns = clampInt(requestUrl.searchParams.get("cols"), 1, 120, 48);
  const maxWidth = clampInt(requestUrl.searchParams.get("maxWidth"), 240, 4000, 1000);

  const { contributors } = getContributorDirectoryData();
  const count = contributors.length;

  const stride = size + gap;
  const maxColumnsByWidth = Math.max(1, Math.floor((maxWidth + gap) / stride));
  const columns = Math.min(maxColumns, maxColumnsByWidth, Math.max(1, count));
  const rows = Math.max(1, Math.ceil(count / columns));
  const width = columns * stride - gap;
  const height = rows * stride - gap;

  const images = contributors
    .map((contributor, index) => {
      const x = (index % columns) * stride;
      const y = Math.floor(index / columns) * stride;
      const src = escapeAttribute(withAvatarSize(contributor.avatarUrl, size * 2));

      return `  <image href="${src}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice" />`;
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <clipPath id="avatarClip" clipPathUnits="objectBoundingBox">
      <circle cx="0.5" cy="0.5" r="0.5" />
    </clipPath>
  </defs>
${images}
</svg>
`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
