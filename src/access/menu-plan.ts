import { atLeast, type PlanTier } from "./plan";

export type PlanMenuResource = {
  name: string;
  meta?: { minPlan?: string; [key: string]: unknown };
};

export type PlanMenuTreeItem = {
  name?: string;
  key?: string;
  list?: string;
  label?: unknown;
  meta?: {
    minPlan?: string;
    planLocked?: boolean;
    label?: unknown;
    icon?: unknown;
    [key: string]: unknown;
  };
  children?: PlanMenuTreeItem[];
  [key: string]: unknown;
};

export type PlanAnnotatedMenuItem = PlanMenuTreeItem & {
  meta?: PlanMenuTreeItem["meta"] & {
    planLocked?: boolean;
    minPlan?: string;
  };
  children?: PlanAnnotatedMenuItem[];
};

/** Read optional `meta.minPlan` from a resource definition list. */
export function resourceMinPlan(
  name: string | undefined,
  source: PlanMenuResource[],
): PlanTier | null {
  if (!name) return null;
  const row = source.find((r) => r.name === name);
  const min = row?.meta?.minPlan;
  return typeof min === "string" && min.trim()
    ? (min.trim() as PlanTier)
    : null;
}

/**
 * Keep all menu nodes visible; mark nodes whose `meta.minPlan` the tenant
 * does not meet so the sider can show an Upgrade affordance.
 */
export function annotateMenuItemsByPlan(
  items: PlanMenuTreeItem[],
  planTier: string | null | undefined,
  source: PlanMenuResource[],
): PlanAnnotatedMenuItem[] {
  const out: PlanAnnotatedMenuItem[] = [];
  for (const item of items) {
    const children = item.children?.length
      ? annotateMenuItemsByPlan(item.children, planTier, source)
      : undefined;
    const min = resourceMinPlan(item.name, source);
    const planLocked = Boolean(min && !atLeast(planTier, min));
    out.push({
      ...item,
      children,
      meta: {
        ...item.meta,
        ...(min ? { minPlan: min } : {}),
        planLocked,
      },
    });
  }
  return out;
}
