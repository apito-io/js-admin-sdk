/** Control-plane tenant plan tiers (engine `pro_tenants.plan_tier`). */
export const PLAN_TIERS = ["free", "paid", "paid_plus", "ultra"] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];

const PLAN_RANK: Record<PlanTier, number> = {
  free: 0,
  paid: 1,
  paid_plus: 2,
  ultra: 3,
};

/** Normalize unknown/empty plan strings to a known tier (default free). */
export function parsePlanTier(raw: string | null | undefined): PlanTier {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  switch (key) {
    case "paid":
      return "paid";
    case "paid_plus":
    case "paid+":
    case "paidplus":
      return "paid_plus";
    case "ultra":
      return "ultra";
    case "free":
    case "":
    default:
      return "free";
  }
}

export function planRank(tier: string | null | undefined): number {
  return PLAN_RANK[parsePlanTier(tier)] ?? 0;
}

/** True when `tier` meets or exceeds `min`. */
export function atLeast(
  tier: string | null | undefined,
  min: string | null | undefined,
): boolean {
  return planRank(tier) >= planRank(min);
}
