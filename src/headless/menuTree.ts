import type { ReactNode } from "react";

export type ApitoMenuResource = {
  name: string;
  list?: string;
  meta?: {
    label?: string;
    icon?: ReactNode;
    parent?: string;
    [key: string]: unknown;
  };
};

export type ApitoMenuTreeItem = {
  key: string;
  name: string;
  label?: ReactNode;
  list?: string;
  route?: string;
  icon?: ReactNode;
  meta?: ApitoMenuResource["meta"];
  children: ApitoMenuTreeItem[];
};

/** Build nested sidebar menu items from flat Refine-style resource definitions. */
export function buildResourceMenuTree(
  resources: ApitoMenuResource[],
): ApitoMenuTreeItem[] {
  const nodes = new Map<string, ApitoMenuTreeItem>();

  for (const resource of resources) {
    nodes.set(resource.name, {
      key: resource.name,
      name: resource.name,
      label: resource.meta?.label ?? resource.name,
      list: resource.list,
      route: resource.list,
      icon: resource.meta?.icon,
      meta: resource.meta,
      children: [],
    });
  }

  const roots: ApitoMenuTreeItem[] = [];

  for (const resource of resources) {
    const node = nodes.get(resource.name)!;
    const parentName = resource.meta?.parent;
    if (parentName && nodes.has(parentName)) {
      nodes.get(parentName)!.children.push(node);
      continue;
    }
    if (!parentName) {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Parent menu keys to keep open for the active route (root → leaf parent).
 * Walks `meta.parent` on flat resources. Empty when `selectedName` is missing
 * or has no parents — submenus stay collapsed unless the route needs them.
 */
export function collectResourceParentKeys(
  resources: ApitoMenuResource[],
  selectedName: string | null | undefined,
): string[] {
  if (!selectedName) return [];
  const byName = new Map(resources.map((r) => [r.name, r]));
  if (!byName.has(selectedName)) return [];
  const keys: string[] = [];
  let current = byName.get(selectedName);
  const seen = new Set<string>();
  while (current?.meta?.parent) {
    const parent = current.meta.parent;
    if (seen.has(parent)) break;
    seen.add(parent);
    keys.unshift(parent);
    current = byName.get(parent);
  }
  return keys;
}

/**
 * Ancestor keys for a selected tree node (root → immediate parent).
 * Prefer {@link collectResourceParentKeys} when you still have flat resources.
 */
export function collectMenuAncestorKeys(
  tree: ApitoMenuTreeItem[],
  selectedKey: string | null | undefined,
): string[] {
  if (!selectedKey) return [];
  const path: string[] = [];
  const walk = (items: ApitoMenuTreeItem[], ancestors: string[]): boolean => {
    for (const item of items) {
      if (item.key === selectedKey || item.name === selectedKey) {
        path.push(...ancestors);
        return true;
      }
      if (item.children?.length && walk(item.children, [...ancestors, item.key])) {
        return true;
      }
    }
    return false;
  };
  walk(tree, []);
  return path;
}
