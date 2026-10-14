import { create } from "zustand";

import { createDefaultBlock } from "@/blocks/defaults";
import type { BlockType, PageBlock } from "@/blocks/schema";

type PageEditorState = {
  pageId: string | null;
  blocks: PageBlock[];
  selectedBlockId: string | null;
  past: PageBlock[][];
  future: PageBlock[][];
  initialize: (pageId: string, blocks: PageBlock[]) => void;
  selectBlock: (blockId: string | null) => void;
  addBlock: (type: BlockType, index?: number) => string;
  updateBlock: (
    blockId: string,
    updater: (block: PageBlock) => PageBlock,
    recordHistory?: boolean,
  ) => void;
  removeBlock: (blockId: string) => void;
  moveBlock: (blockId: string, offset: -1 | 1) => void;
  undo: () => void;
  redo: () => void;
};

function addHistory(state: PageEditorState): PageBlock[][] {
  return [...state.past, state.blocks].slice(-50);
}

export const usePageEditorStore = create<PageEditorState>((set, get) => ({
  pageId: null,
  blocks: [],
  selectedBlockId: null,
  past: [],
  future: [],

  initialize: (pageId, blocks) => {
    if (get().pageId === pageId) return;
    set({
      pageId,
      blocks,
      selectedBlockId: blocks[0]?.id ?? null,
      past: [],
      future: [],
    });
  },

  selectBlock: (selectedBlockId) => set({ selectedBlockId }),

  addBlock: (type, index) => {
    const state = get();
    const block = createDefaultBlock(type);
    const insertionIndex = Math.max(
      0,
      Math.min(index ?? state.blocks.length, state.blocks.length),
    );
    const blocks = [...state.blocks];
    blocks.splice(insertionIndex, 0, block);
    set({
      blocks,
      selectedBlockId: block.id,
      past: addHistory(state),
      future: [],
    });
    return block.id;
  },

  updateBlock: (blockId, updater, recordHistory = true) => {
    const state = get();
    const current = state.blocks.find((block) => block.id === blockId);
    if (!current) return;
    const updated = updater(current);
    if (updated === current) return;

    set({
      blocks: state.blocks.map((block) =>
        block.id === blockId ? updated : block,
      ),
      past: recordHistory ? addHistory(state) : state.past,
      future: recordHistory ? [] : state.future,
    });
  },

  removeBlock: (blockId) => {
    const state = get();
    if (!state.blocks.some((block) => block.id === blockId)) return;
    const blocks = state.blocks.filter((block) => block.id !== blockId);
    set({
      blocks,
      selectedBlockId:
        state.selectedBlockId === blockId
          ? (blocks[0]?.id ?? null)
          : state.selectedBlockId,
      past: addHistory(state),
      future: [],
    });
  },

  moveBlock: (blockId, offset) => {
    const state = get();
    const currentIndex = state.blocks.findIndex((block) => block.id === blockId);
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.blocks.length) {
      return;
    }

    const blocks = [...state.blocks];
    const [block] = blocks.splice(currentIndex, 1);
    if (!block) return;
    blocks.splice(nextIndex, 0, block);

    set({
      blocks,
      selectedBlockId: blockId,
      past: addHistory(state),
      future: [],
    });
  },

  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];
    if (!previous) return;

    const selectedBlockId = previous.some(
      (block) => block.id === state.selectedBlockId,
    )
      ? state.selectedBlockId
      : (previous[0]?.id ?? null);

    set({
      blocks: previous,
      selectedBlockId,
      past: state.past.slice(0, -1),
      future: [state.blocks, ...state.future].slice(0, 50),
    });
  },

  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;

    const selectedBlockId = next.some(
      (block) => block.id === state.selectedBlockId,
    )
      ? state.selectedBlockId
      : (next[0]?.id ?? null);

    set({
      blocks: next,
      selectedBlockId,
      past: [...state.past, state.blocks].slice(-50),
      future: state.future.slice(1),
    });
  },
}));
