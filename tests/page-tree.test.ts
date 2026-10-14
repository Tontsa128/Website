import { describe, expect, it } from "vitest";

import {
  buildPageTree,
  canMovePage,
  collectDescendantIds,
  flattenPageTree,
  movePageInRows,
  renamePageInRows,
  slugifyTitle,
  type PageRow,
} from "../src/lib/pages/tree";

const page = (overrides: Partial<PageRow> & Pick<PageRow, "id" | "path">): PageRow => ({
  site_id: "site-1",
  parent_id: null,
  title: overrides.id,
  slug: overrides.id,
  position: 0,
  show_in_nav: true,
  is_home: false,
  status: "draft",
  ...overrides,
});

const sample: PageRow[] = [
  page({ id: "home", title: "Etusivu", slug: "etusivu", path: "etusivu", position: 0 }),
  page({ id: "services", parent_id: "home", title: "Palvelut", slug: "palvelut", path: "etusivu/palvelut", position: 0 }),
  page({ id: "repair", parent_id: "services", title: "Huolto", slug: "huolto", path: "etusivu/palvelut/huolto", position: 0 }),
  page({ id: "pricing", parent_id: "home", title: "Hinnasto", slug: "hinnasto", path: "etusivu/hinnasto", position: 1 }),
  page({ id: "contact", title: "Yhteystiedot", slug: "yhteystiedot", path: "yhteystiedot", position: 1 }),
];

describe("page tree", () => {
  it("builds nested children in sibling position order", () => {
    const tree = buildPageTree(sample);
    expect(tree.map((node) => node.id)).toEqual(["home", "contact"]);
    expect(tree[0]?.children.map((node) => node.id)).toEqual(["services", "pricing"]);
    expect(tree[0]?.children[0]?.children[0]?.id).toBe("repair");
    expect(flattenPageTree(tree).map((node) => node.id)).toEqual([
      "home",
      "services",
      "repair",
      "pricing",
      "contact",
    ]);
  });

  it("roots malformed cycles rather than recursing forever", () => {
    const cyclic = [
      page({ id: "a", parent_id: "b", path: "a" }),
      page({ id: "b", parent_id: "a", path: "b" }),
    ];
    expect(flattenPageTree(buildPageTree(cyclic))).toHaveLength(2);
  });

  it("blocks self moves, descendant moves, missing parents and cross-site parents", () => {
    const otherSite = page({ id: "foreign", site_id: "site-2", path: "foreign" });
    expect(canMovePage(sample, "home", "home")).toBe(false);
    expect(canMovePage(sample, "home", "repair")).toBe(false);
    expect(canMovePage(sample, "services", "missing")).toBe(false);
    expect(canMovePage([...sample, otherSite], "services", "foreign")).toBe(false);
    expect(canMovePage(sample, "repair", "contact")).toBe(true);
  });

  it("moves a deep page and updates its full path and sibling positions", () => {
    const moved = movePageInRows(sample, "repair", "pricing", 0);
    expect(moved.find((node) => node.id === "repair")).toMatchObject({
      parent_id: "pricing",
      path: "etusivu/hinnasto/huolto",
      position: 0,
    });
    expect(moved.find((node) => node.id === "services")).toMatchObject({
      path: "etusivu/palvelut",
      position: 0,
    });
    expect(collectDescendantIds(moved, "home")).toEqual(["services", "pricing", "repair"]);
  });

  it("reorders siblings without changing parent paths", () => {
    const moved = movePageInRows(sample, "pricing", "home", 0);
    expect(moved.find((node) => node.id === "pricing")?.position).toBe(0);
    expect(moved.find((node) => node.id === "services")?.position).toBe(1);
    expect(moved.find((node) => node.id === "repair")?.path).toBe(
      "etusivu/palvelut/huolto",
    );
  });

  it("renames a page and all descendant paths", () => {
    const renamed = renamePageInRows(sample, "services", "Palvelut ja hinnat");
    expect(renamed.find((node) => node.id === "services")).toMatchObject({
      title: "Palvelut ja hinnat",
      slug: "palvelut-ja-hinnat",
      path: "etusivu/palvelut-ja-hinnat",
    });
    expect(renamed.find((node) => node.id === "repair")?.path).toBe(
      "etusivu/palvelut-ja-hinnat/huolto",
    );
  });

  it("makes a duplicate slug unique among siblings", () => {
    const renamed = renamePageInRows(sample, "pricing", "Palvelut");
    expect(renamed.find((node) => node.id === "pricing")?.slug).toBe("palvelut-2");
  });

  it("creates url-friendly Finnish slugs", () => {
    expect(slugifyTitle("Äänentoisto & Öljynvaihto")).toBe("aanentoisto-oljynvaihto");
    expect(slugifyTitle("  !!!  ")).toBe("page");
  });
});
