/** Ensure uploaded blobs have a recognizable image extension for storage APIs. */
export function ensureImageFileName(file: File): File {
  if (/\.(jpe?g|png|gif|webp|avif|heic|heif|svg)$/i.test(file.name)) {
    return file;
  }
  const type = file.type || "image/jpeg";
  const ext =
    type === "image/png"
      ? ".png"
      : type === "image/webp"
        ? ".webp"
        : type === "image/gif"
          ? ".gif"
          : ".jpg";
  return new File([file], `image${ext}`, { type });
}
