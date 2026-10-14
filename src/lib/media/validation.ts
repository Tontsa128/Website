import type { SupportedSourceMime } from "./types";

export const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 40_000_000;
export const MAX_MEDIA_EDGE = 2560;

export function getExpectedImageFormat(
  mime: string,
): "jpeg" | "png" | "webp" | null {
  switch (mime) {
    case "image/jpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

export function getExtensionForMime(
  mime: string,
): ".jpg" | ".png" | ".webp" | null {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return null;
  }
}

export function isSupportedSourceMime(value: string): value is SupportedSourceMime {
  return getExpectedImageFormat(value) !== null;
}

export function sanitizeOriginalFilename(value: string): string {
  const basename = value.replace(/\\/g, "/").split("/").pop() ?? "image";
  const cleaned = basename
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return cleaned || "image";
}

export function isValidInboxObjectPath(siteId: string, path: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 2 || parts[0] !== siteId) return false;
  return /^[0-9a-f-]{36}\.(?:jpe?g|png|webp)$/i.test(parts[1] ?? "");
}

export type PageContentRow = {
  id: string;
  content: unknown;
  published_content: unknown;
};

export function collectMediaReferences(value: unknown, result = new Set<string>()): Set<string> {
  const visited = new Set<object>();

  function visit(current: unknown): void {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current !== "object" || current === null) return;
    if (visited.has(current)) return;
    visited.add(current);

    const record = current as Record<string, unknown>;
    if (typeof record.mediaId === "string") result.add(record.mediaId);
    if (Array.isArray(record.mediaIds)) {
      for (const id of record.mediaIds) {
        if (typeof id === "string") result.add(id);
      }
    }
    Object.values(record).forEach(visit);
  }

  visit(value);
  return result;
}

export function countMediaUsageByPage(
  pages: PageContentRow[],
  mediaId: string,
): number {
  let count = 0;
  for (const page of pages) {
    const refs = collectMediaReferences({
      content: page.content,
      published_content: page.published_content,
    });
    if (refs.has(mediaId)) count += 1;
  }
  return count;
}
