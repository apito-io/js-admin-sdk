export type ApitoMediaFileKind = "image" | "pdf" | "document" | "other";

export type ApitoMediaUploadFileType = "media" | "pdf" | "document" | "other";

export type ApitoMediaAcceptOptions = {
  /** HTML `accept` attribute, e.g. `image/*,application/pdf` */
  accept?: string;
  /** Shorthand when `accept` is omitted */
  kinds?: ApitoMediaFileKind[];
};

const KIND_ACCEPT: Record<ApitoMediaFileKind, string> = {
  image: "image/*",
  pdf: "application/pdf,.pdf",
  document: ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv",
  other: "*/*",
};

export function resolveMediaAccept(options?: ApitoMediaAcceptOptions): string {
  if (options?.accept?.trim()) return options.accept.trim();
  const kinds = options?.kinds?.length ? options.kinds : (["image"] as ApitoMediaFileKind[]);
  return kinds.map((k) => KIND_ACCEPT[k]).join(",");
}

export function isImageMediaUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|heic|heif|svg)(\?|$)/i.test(url);
}

export function isPdfMediaUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url) || url.toLowerCase().includes("application/pdf");
}

export function inferMediaFileKind(file: File): ApitoMediaFileKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (
    file.type.includes("document") ||
    file.type.includes("sheet") ||
    file.type.includes("text") ||
    /\.(docx?|xlsx?|txt|csv)$/i.test(file.name)
  ) {
    return "document";
  }
  return "other";
}

export function fileMatchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0 || tokens.includes("*/*")) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return tokens.some((token) => {
    if (token === "image/*") return type.startsWith("image/");
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

export function acceptAllowsOnlyImages(accept: string): boolean {
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => t === "image/*" || t.startsWith("image/"));
}

export function defaultUploadFileTypeForKind(kind: ApitoMediaFileKind): ApitoMediaUploadFileType {
  if (kind === "image") return "media";
  if (kind === "pdf") return "pdf";
  if (kind === "document") return "document";
  return "other";
}
