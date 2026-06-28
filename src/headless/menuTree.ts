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
