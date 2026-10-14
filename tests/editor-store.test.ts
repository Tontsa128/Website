import { beforeEach, describe, expect, it } from "vitest";

import { createDefaultBlock, createDefaultPageContent } from "../src/blocks/defaults";
import { usePageEditorStore } from "../src/lib/editor/store";

function resetStore(): void {
  usePageEditorStore.getState().initialize(crypto.randomUUID(), createDefaultPageContent());
}

describe("page editor Zustand store", () => {
  beforeEach(() => {
    resetStore();
  });

  it("adds a block and supports undo/redo", () => {
    const before = usePageEditorStore.getState().blocks.length;
    usePageEditorStore.getState().addBlock("button");

    expect(usePageEditorStore.getState().blocks).toHaveLength(before + 1);
    usePageEditorStore.getState().undo();
    expect(usePageEditorStore.getState().blocks).toHaveLength(before);
    usePageEditorStore.getState().redo();
    expect(usePageEditorStore.getState().blocks).toHaveLength(before + 1);
  });

  it("duplicates a block with a new stable id and cloned props", () => {
    const source = usePageEditorStore.getState().blocks[0];
    if (!source) throw new Error("Default page content is missing its hero block");

    const duplicateId = usePageEditorStore.getState().duplicateBlock(source.id, 1);
    const duplicate = usePageEditorStore.getState().blocks.find((block) => block.id === duplicateId);

    expect(duplicate).toBeDefined();
    expect(duplicate?.id).not.toBe(source.id);
    expect(duplicate?.type).toBe(source.type);
    expect(duplicate?.props).toEqual(source.props);
    expect(duplicate?.props).not.toBe(source.props);
  });

  it("moves blocks up and down without changing their ids", () => {
    const before = usePageEditorStore.getState().blocks;
    const first = before[0];
    const second = before[1];
    if (!first || !second) throw new Error("Default page content is incomplete");

    usePageEditorStore.getState().moveBlock(second.id, -1);
    expect(usePageEditorStore.getState().blocks[0]?.id).toBe(second.id);
    usePageEditorStore.getState().moveBlock(second.id, 1);
    expect(usePageEditorStore.getState().blocks[0]?.id).toBe(first.id);
  });

  it("updates selected block props and undo restores the previous value", () => {
    const hero = usePageEditorStore.getState().blocks.find((block) => block.type === "hero");
    if (!hero || hero.type !== "hero") throw new Error("Default hero block is missing");

    usePageEditorStore.getState().updateBlock(hero.id, (block) => {
      if (block.type !== "hero") return block;
      return { ...block, props: { ...block.props, title: "Uusi otsikko" } };
    });

    const changed = usePageEditorStore.getState().blocks.find((block) => block.id === hero.id);
    expect(changed?.type === "hero" ? changed.props.title : "").toBe("Uusi otsikko");

    usePageEditorStore.getState().undo();
    const reverted = usePageEditorStore.getState().blocks.find((block) => block.id === hero.id);
    expect(reverted?.type === "hero" ? reverted.props.title : "").toBe(hero.props.title);
  });

  it("does not create a history item for unknown block ids", () => {
    const previousHistoryCount = usePageEditorStore.getState().past.length;
    usePageEditorStore.getState().updateBlock(crypto.randomUUID(), (block) => block);
    expect(usePageEditorStore.getState().past).toHaveLength(previousHistoryCount);
  });

  it("keeps existing block ids unique when adding a default block", () => {
    usePageEditorStore.getState().addBlock("image");
    const ids = usePageEditorStore.getState().blocks.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length === 36)).toBe(true);
  });
});
