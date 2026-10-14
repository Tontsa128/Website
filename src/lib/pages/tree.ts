export type PageStatus = "draft" | "published";

export type PageRow = {
  id: string;
  site_id: string;
  parent_id: string | null;
  title: string;
  slug: string;
  position: number;
  path: string;
  show_in_nav: boolean;
  is_home: boolean;
  status: PageStatus;
};

export type PageTreeNode = PageRow & {
  children: PageTreeNode[];
};

function comparePages(left: PageRow, right: PageRow): number {
  return left.position - right.position || left.title.localeCompare(right.title);
}

function hasSafeParentChain(
  page: PageRow,
  parentId: string,
  byId: Map<string, PageRow>,
): boolean {
  const seen = new Set<string>([page.id]);
  let currentId: string | null = parentId;

  while (currentId) {
    if (seen.has(currentId)) return false;
    seen.add(currentId);

    const ancestor: PageRow | undefined = byId.get(currentId);
    if (!ancestor || ancestor.site_id !== page.site_id) return false;
    currentId = ancestor.parent_id;
  }

  return true;
}

export function buildPageTree(pages: PageRow[]): PageTreeNode[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const nodes = new Map<string, PageTreeNode>();
  const safeParents = new Map<string, string | null>();

  for (const page of pages) {
    const parentId = page.parent_id;
    safeParents.set(
      page.id,
      parentId && hasSafeParentChain(page, parentId, byId) ? parentId : null,
    );
    nodes.set(page.id, { ...page, children: [] });
  }

  const roots: PageTreeNode[] = [];
  for (const page of pages) {
    const node = nodes.get(page.id);
    if (!node) continue;

    const parentId = safeParents.get(page.id);
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  function sortDeep(items: PageTreeNode[]): void {
    items.sort(comparePages);
    items.forEach((node) => sortDeep(node.children));
  }

  sortDeep(roots);
  return roots;
}

export function flattenPageTree(nodes: PageTreeNode[]): PageRow[] {
  const result: PageRow[] = [];

  function visit(items: PageTreeNode[]): void {
    for (const item of items) {
      const { children, ...page } = item;
      result.push(page);
      visit(children);
    }
  }

  visit(nodes);
  return result;
}

export function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .toLocaleLowerCase("fi-FI")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "page";
}

export function canMovePage(
  pages: PageRow[],
  pageId: string,
  newParentId: string | null,
): boolean {
  const page = pages.find((item) => item.id === pageId);
  if (!page) return false;
  if (newParentId === null) return true;
  if (pageId === newParentId) return false;

  const byId = new Map(pages.map((item) => [item.id, item]));
  let cursor: string | null = newParentId;
  const visited = new Set<string>();

  while (cursor) {
    if (cursor === pageId || visited.has(cursor)) return false;
    visited.add(cursor);
    const current: PageRow | undefined = byId.get(cursor);
    if (!current || current.site_id !== page.site_id) return false;
    cursor = current.parent_id;
  }

  const parent = byId.get(newParentId);
  return Boolean(parent && parent.site_id === page.site_id);
}

export function collectDescendantIds(pages: PageRow[], pageId: string): string[] {
  const descendants: string[] = [];
  const childrenByParent = new Map<string, string[]>();

  for (const page of pages) {
    if (!page.parent_id) continue;
    const children = childrenByParent.get(page.parent_id) ?? [];
    children.push(page.id);
    childrenByParent.set(page.parent_id, children);
  }

  const visited = new Set<string>([pageId]);
  const pending = [...(childrenByParent.get(pageId) ?? [])];

  while (pending.length > 0) {
    const nextId = pending.shift();
    if (!nextId || visited.has(nextId)) continue;
    visited.add(nextId);
    descendants.push(nextId);
    pending.push(...(childrenByParent.get(nextId) ?? []));
  }

  return descendants;
}

export function movePageInRows(
  pages: PageRow[],
  pageId: string,
  newParentId: string | null,
  requestedPosition: number,
): PageRow[] {
  const page = pages.find((item) => item.id === pageId);
  if (!page) throw new Error("Page not found");
  if (!canMovePage(pages, pageId, newParentId)) {
    throw new Error("Invalid page move");
  }

  const newParent = newParentId
    ? pages.find((item) => item.id === newParentId)
    : undefined;
  if (newParentId && !newParent) throw new Error("Parent page not found");

  const oldPath = page.path;
  const newPath = newParent ? newParent.path + "/" + page.slug : page.slug;
  const destinationSiblings = pages
    .filter(
      (item) =>
        item.site_id === page.site_id &&
        item.parent_id === newParentId &&
        item.id !== pageId,
    )
    .sort(comparePages);
  const insertionIndex = Math.max(
    0,
    Math.min(Math.trunc(requestedPosition), destinationSiblings.length),
  );

  destinationSiblings.splice(insertionIndex, 0, {
    ...page,
    parent_id: newParentId,
    path: newPath,
    position: insertionIndex,
  });

  const positions = new Map<string, number>();
  destinationSiblings.forEach((item, index) => positions.set(item.id, index));

  if (page.parent_id !== newParentId) {
    pages
      .filter(
        (item) =>
          item.site_id === page.site_id &&
          item.parent_id === page.parent_id &&
          item.id !== pageId,
      )
      .sort(comparePages)
      .forEach((item, index) => positions.set(item.id, index));
  }

  return pages.map((item) => {
    let next = item;
    if (item.id === pageId) {
      next = { ...item, parent_id: newParentId, path: newPath };
    } else if (
      item.site_id === page.site_id &&
      item.path.startsWith(oldPath + "/")
    ) {
      next = {
        ...item,
        path: newPath + item.path.slice(oldPath.length),
      };
    }

    const position = positions.get(next.id);
    return position === undefined ? next : { ...next, position };
  });
}

export function renamePageInRows(
  pages: PageRow[],
  pageId: string,
  newTitle: string,
): PageRow[] {
  const title = newTitle.trim();
  if (title.length < 1 || title.length > 80) {
    throw new Error("Page title must contain between 1 and 80 characters");
  }

  const page = pages.find((item) => item.id === pageId);
  if (!page) throw new Error("Page not found");

  const base = slugifyTitle(title).slice(0, 70);
  let slug = base;
  let suffix = 2;
  while (
    pages.some(
      (item) =>
        item.id !== pageId &&
        item.site_id === page.site_id &&
        item.parent_id === page.parent_id &&
        item.slug === slug,
    )
  ) {
    slug = base.slice(0, 77 - String(suffix).length) + "-" + suffix;
    suffix += 1;
  }

  const parent = page.parent_id
    ? pages.find((item) => item.id === page.parent_id)
    : undefined;
  const newPath = parent ? parent.path + "/" + slug : slug;
  const oldPath = page.path;

  return pages.map((item) => {
    if (item.id === pageId) {
      return { ...item, title, slug, path: newPath };
    }
    if (
      item.site_id === page.site_id &&
      item.path.startsWith(oldPath + "/")
    ) {
      return {
        ...item,
        path: newPath + item.path.slice(oldPath.length),
      };
    }
    return item;
  });
}
