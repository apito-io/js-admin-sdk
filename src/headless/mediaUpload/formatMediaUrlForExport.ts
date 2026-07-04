function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function isInlineMediaContent(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:")) return true;
  if (trimmed.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) return true;
  return false;
}

function readUrlCandidate(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || isInlineMediaContent(trimmed)) return "";
  return trimmed;
}

/** True when a URL points at remote media (extension optional). */
export function isHttpMediaUrl(url: string): boolean {
  return isHttpUrl(url);
}

export function isMediaLikeValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return isHttpUrl(trimmed) || trimmed.startsWith("data:");
  }
  if (Array.isArray(value)) {
    return value.some((item) => isMediaLikeValue(item));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      typeof record.url === "string" ||
      typeof record.public_url === "string" ||
      typeof record.href === "string"
    );
  }
  return false;
}

/** Extract a remote media URL from Apito image/file field shapes. */
export function extractMediaUrlFromValue(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "string") {
    return readUrlCandidate(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractMediaUrlFromValue(item);
      if (url) return url;
    }
    return "";
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "public_url", "href"] as const) {
      const candidate = readUrlCandidate(record[key]);
      if (candidate) return candidate;
    }
  }

  return "";
}

/** CSV/XLSX export: always emit http(s) URLs, never inline/base64 image content. */
export function formatMediaUrlForExport(value: unknown): string {
  const url = extractMediaUrlFromValue(value);
  if (!url) return "";
  return isHttpUrl(url) ? url : "";
}
