/** Detect engine plan quota errors (create blocked by max_records.*). */
export function isPlanQuotaError(error: unknown): boolean {
  const msg =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : error != null
          ? String(error)
          : "";
  const lower = msg.toLowerCase();
  return (
    lower.includes("plan quota exceeded") ||
    lower.includes("max_records.")
  );
}
