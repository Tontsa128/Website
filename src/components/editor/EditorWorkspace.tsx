"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { savePageContentAction } from "@/app/(dashboard)/editor/actions";
import { BLOCK_REGISTRY, BLOCK_TYPES } from "@/blocks/registry";
import { BlockPreview, RichTextView } from "@/blocks/BlockRenderer";
import { createDefaultBlock, createRichTextDocument } from "@/blocks/defaults";
import type { BlockType, PageBlock, RichTextDocument } from "@/blocks/schema";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { usePageEditorStore } from "@/lib/editor/store";

type DeviceMode = "mobile" | "tablet" | "desktop";
type SaveState = "saved" | "saving" | "error";

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200";
const smallButtonClass =
  "min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

function replaceRichTextInBlock(
  block: PageBlock,
  cellIndex: number | null,
  content: RichTextDocument,
): PageBlock {
  if (block.type === "text" && cellIndex === null) {
    return { ...block, props: { ...block.props, content } };
  }
  if (block.type === "columns" && cellIndex !== null) {
    const cells = [...block.props.cells];
    if (cellIndex >= 0 && cellIndex < cells.length) cells[cellIndex] = content;
    return { ...block, props: { ...block.props, cells } };
  }
  return block;
}

function RichBlockText({
  block,
  cellIndex,
  previewOnly,
  onChange,
}: {
  block: PageBlock;
  cellIndex: number | null;
  previewOnly: boolean;
  onChange: (content: RichTextDocument) => void;
}) {
  const content =
    block.type === "text"
      ? block.props.content
      : block.type === "columns" && cellIndex !== null
        ? block.props.cells[cellIndex] ?? createRichTextDocument()
        : createRichTextDocument();

  if (previewOnly) {
    return <RichTextView content={content} className="px-2 py-2" />;
  }

  return (
    <RichTextEditor
      value={content}
      label={cellIndex === null ? "Sivun teksti, muokkaa suoraan" : "Sarakkeen teksti, muokkaa suoraan"}
      onChange={onChange}
    />
  );
}

function BlockSettings({
  block,
  onUpdate,
}: {
  block: PageBlock;
  onUpdate: (updater: (current: PageBlock) => PageBlock) => void;
}) {
  if (block.type === "hero") {
    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Pääotsikko
          <input
            className={inputClass}
            maxLength={120}
            value={block.props.title}
            onChange={(event) =>
              onUpdate((current) =>
                current.type === "hero"
                  ? { ...current, props: { ...current.props, title: event.target.value } }
                  : current,
              )
            }
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Kuvausteksti
          <textarea
            className={inputClass + " min-h-28"}
            maxLength={800}
            value={block.props.subtitle}
            onChange={(event) =>
              onUpdate((current) =>
                current.type === "hero"
                  ? { ...current, props: { ...current.props, subtitle: event.target.value } }
                  : current,
              )
            }
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Painikkeen teksti
          <input
            className={inputClass}
            maxLength={80}
            value={block.props.buttonLabel}
            onChange={(event) =>
              onUpdate((current) =>
                current.type === "hero"
                  ? { ...current, props: { ...current.props, buttonLabel: event.target.value } }
                  : current,
              )
            }
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Painikkeen linkki
          <input
            className={inputClass}
            maxLength={2000}
            value={block.props.buttonHref}
            onChange={(event) =>
              onUpdate((current) =>
                current.type === "hero"
                  ? { ...current, props: { ...current.props, buttonHref: event.target.value } }
                  : current,
              )
            }
          />
        </label>
        <p className="text-xs leading-5 text-slate-500">
          Sallittuja ovat sisäiset polut, HTTP/HTTPS-, sähköposti- ja puhelinlinkit.
        </p>
      </div>
    );
  }

  if (block.type === "text") {
    return (
      <p className="text-sm leading-6 text-slate-600">
        Muokkaa tekstiä suoraan sivun esikatselussa. Otsikot, listat, linkit, lihavointi ja kursivointi löytyvät tekstityökalupalkista.
      </p>
    );
  }

  if (block.type === "image") {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">
          Kuvan valinta ja lataus tulevat vaiheessa 4. Alt-teksti voidaan jo tallentaa kuvalohkoon.
        </p>
        <label className="block text-sm font-medium text-slate-700">
          Vaihtoehtoinen teksti
          <textarea
            className={inputClass + " min-h-24"}
            maxLength={500}
            value={block.props.altText}
            onChange={(event) =>
              onUpdate((current) =>
                current.type === "image"
                  ? { ...current, props: { ...current.props, altText: event.target.value } }
                  : current,
              )
            }
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Kuvateksti
          <textarea
            className={inputClass + " min-h-20"}
            maxLength={500}
            value={block.props.caption}
            onChange={(event) =>
              onUpdate((current) =>
                current.type === "image"
                  ? { ...current, props: { ...current.props, caption: event.target.value } }
                  : current,
              )
            }
          />
        </label>
      </div>
    );
  }

  if (block.type === "button") {
    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Painikkeen teksti
          <input
            className={inputClass}
            maxLength={80}
            value={block.props.label}
            onChange={(event) =>
              onUpdate((current) =>
                current.type === "button"
                  ? { ...current, props: { ...current.props, label: event.target.value } }
                  : current,
              )
            }
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Linkkikohde
          <input
            className={inputClass}
            maxLength={2000}
            value={block.props.href}
            onChange={(event) =>
              onUpdate((current) =>
                current.type === "button"
                  ? { ...current, props: { ...current.props, href: event.target.value } }
                  : current,
              )
            }
          />
        </label>
      </div>
    );
  }

  const nextLayout = block.props.layout === 2 ? 3 : 2;
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Palstojen määrä
        <select
          className={inputClass}
          value={block.props.layout}
          onChange={(event) => {
            const layout: 2 | 3 = event.target.value === "3" ? 3 : 2;
            onUpdate((current) => {
              if (current.type !== "columns") return current;
              const cells = [...current.props.cells];
              while (cells.length < layout) {
                cells.push(createRichTextDocument("Kolmannen palstan teksti"));
              }
              return {
                ...current,
                props: {
                  layout,
                  cells: cells.slice(0, layout),
                },
              };
            });
          }}
        >
          <option value={2}>2 palstaa</option>
          <option value={3}>3 palstaa</option>
        </select>
      </label>
      <p className="text-sm leading-6 text-slate-600">
        Muokkaa jokaisen palstan tekstiä suoraan esikatselussa. Mobiilissa palstat pinoutuvat allekkain.
      </p>
      <p className="text-xs text-slate-500">Valittavissa: {nextLayout} palstaa.</p>
    </div>
  );
}

function PreviewBlock({
  block,
  index,
  count,
  selected,
  previewOnly,
  onSelect,
  onUpdateRichText,
  onMove,
  onRemove,
  onDuplicate,
}: {
  block: PageBlock;
  index: number;
  count: number;
  selected: boolean;
  previewOnly: boolean;
  onSelect: () => void;
  onUpdateRichText: (cellIndex: number | null, content: RichTextDocument) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  return (
    <article
      className={
        "group min-w-0 rounded-2xl border bg-white p-3 transition " +
        (selected && !previewOnly
          ? "border-sky-500 ring-2 ring-sky-100"
          : "border-transparent hover:border-slate-200")
      }
      onClick={() => {
        if (!previewOnly) onSelect();
      }}
    >
      {!previewOnly && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <button
            type="button"
            className="min-h-9 rounded-lg px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
          >
            {BLOCK_REGISTRY[block.type].icon} {BLOCK_REGISTRY[block.type].label}
            {selected ? " · valittu" : ""}
          </button>
          {selected && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={smallButtonClass} aria-label="Siirrä lohkoa ylöspäin" disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMove(-1); }}>
                ↑
              </button>
              <button type="button" className={smallButtonClass} aria-label="Siirrä lohkoa alaspäin" disabled={index === count - 1} onClick={(event) => { event.stopPropagation(); onMove(1); }}>
                ↓
              </button>
              <button type="button" className={smallButtonClass} onClick={(event) => { event.stopPropagation(); onDuplicate(); }}>
                Kopioi
              </button>
              <button type="button" className={smallButtonClass + " border-red-200 text-red-700 hover:bg-red-50"} onClick={(event) => { event.stopPropagation(); onRemove(); }}>
                Poista
              </button>
            </div>
          )}
        </div>
      )}

      {block.type === "text" ? (
        <RichBlockText
          block={block}
          cellIndex={null}
          previewOnly={previewOnly}
          onChange={(content) => onUpdateRichText(null, content)}
        />
      ) : block.type === "columns" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {block.props.cells.map((_, cellIndex) => (
            <div key={block.id + "-editor-cell-" + cellIndex} className="min-w-0">
              <RichBlockText
                block={block}
                cellIndex={cellIndex}
                previewOnly={previewOnly}
                onChange={(content) => onUpdateRichText(cellIndex, content)}
              />
            </div>
          ))}
        </div>
      ) : (
        <BlockPreview block={block} />
      )}
    </article>
  );
}

export function EditorWorkspace({
  pageId,
  siteId,
  pageTitle,
  siteName,
  initialBlocks,
  savedContentFingerprint,
}: {
  pageId: string;
  siteId: string;
  pageTitle: string;
  siteName: string;
  initialBlocks: PageBlock[];
  savedContentFingerprint: string;
}) {
  const storePageId = usePageEditorStore((state) => state.pageId);
  const blocks = usePageEditorStore((state) => state.blocks);
  const selectedBlockId = usePageEditorStore((state) => state.selectedBlockId);
  const initialize = usePageEditorStore((state) => state.initialize);
  const selectBlock = usePageEditorStore((state) => state.selectBlock);
  const addBlock = usePageEditorStore((state) => state.addBlock);
  const updateBlock = usePageEditorStore((state) => state.updateBlock);
  const removeBlock = usePageEditorStore((state) => state.removeBlock);
  const moveBlock = usePageEditorStore((state) => state.moveBlock);
  const undo = usePageEditorStore((state) => state.undo);
  const redo = usePageEditorStore((state) => state.redo);

  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [previewOnly, setPreviewOnly] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveMessage, setSaveMessage] = useState("");
  const lastSavedFingerprint = useRef(savedContentFingerprint);
  const latestSaveAttempt = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    initialize(pageId, initialBlocks);
  }, [initialBlocks, initialize, pageId]);

  useEffect(() => {
    lastSavedFingerprint.current = savedContentFingerprint;
  }, [pageId, savedContentFingerprint]);

  const ready = storePageId === pageId;
  const currentFingerprint = useMemo(() => JSON.stringify(blocks), [blocks]);

  useEffect(() => {
    if (!ready) return;
    if (currentFingerprint === lastSavedFingerprint.current) {
      setSaveState("saved");
      return;
    }

    const attempt = latestSaveAttempt.current + 1;
    latestSaveAttempt.current = attempt;
    setSaveState("saving");
    setSaveMessage("");

    const timer = window.setTimeout(() => {
      const snapshot = blocks;
      const fingerprint = currentFingerprint;

      saveQueue.current = saveQueue.current.then(async () => {
        if (fingerprint === lastSavedFingerprint.current) return;
        const result = await savePageContentAction(pageId, snapshot);

        if (result.ok) {
          lastSavedFingerprint.current = fingerprint;
          if (attempt === latestSaveAttempt.current) {
            setSaveState("saved");
            setSaveMessage(result.message);
          }
        } else if (attempt === latestSaveAttempt.current) {
          setSaveState("error");
          setSaveMessage(result.message);
        }
      }).catch(() => {
        if (attempt === latestSaveAttempt.current) {
          setSaveState("error");
          setSaveMessage("Tallennus epäonnistui. Yritä uudelleen.");
        }
      });
    }, 850);

    return () => window.clearTimeout(timer);
  }, [blocks, currentFingerprint, pageId, ready]);

  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) ?? null;
  const selectedIndex = selectedBlock
    ? blocks.findIndex((block) => block.id === selectedBlock.id)
    : -1;

  const updateSelected = useCallback(
    (updater: (block: PageBlock) => PageBlock) => {
      if (selectedBlock) updateBlock(selectedBlock.id, updater);
    },
    [selectedBlock, updateBlock],
  );

  const addNewBlock = useCallback(
    (type: BlockType, index?: number) => {
      const insertionIndex = index ?? (selectedIndex >= 0 ? selectedIndex + 1 : blocks.length);
      addBlock(type, insertionIndex);
      setPreviewOnly(false);
    },
    [addBlock, blocks.length, selectedIndex],
  );

  function duplicateBlock(block: PageBlock) {
    const clone = createDefaultBlock(block.type);
    const copied = { ...clone, props: block.props } as PageBlock;
    addBlock(block.type, selectedIndex + 1);
    const newSelectedId = usePageEditorStore.getState().selectedBlockId;
    if (newSelectedId) {
      updateBlock(newSelectedId, () => copied);
      selectBlock(newSelectedId);
    }
  }

  function updateRichText(
    blockId: string,
    cellIndex: number | null,
    content: RichTextDocument,
  ) {
    updateBlock(
      blockId,
      (current) => replaceRichTextInBlock(current, cellIndex, content),
      false,
    );
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("[contenteditable='true'], input, textarea, select")) {
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;

      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [redo, undo]);

  if (!ready) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-sm text-slate-600">Avataan editoria…</p>
      </main>
    );
  }

  const deviceClass =
    device === "mobile"
      ? "max-w-[390px]"
      : device === "tablet"
        ? "max-w-[768px]"
        : "max-w-none";

  return (
    <main className="min-h-[calc(100vh-65px)] bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={"/dashboard/sites/" + siteId}
              className="flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              ← Takaisin
            </Link>
            <div className="min-w-0">
              <p className="max-w-[60vw] truncate text-sm font-semibold text-slate-900">
                {pageTitle}
              </p>
              <p className="hidden max-w-[60vw] truncate text-xs text-slate-500 sm:block">
                {siteName}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              role="status"
              aria-live="polite"
              className={
                "rounded-full px-3 py-1.5 text-xs font-medium " +
                (saveState === "error"
                  ? "bg-red-50 text-red-800"
                  : saveState === "saving"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-emerald-50 text-emerald-800")
              }
            >
              {saveState === "error" ? "Tallennusvirhe" : saveState === "saving" ? "Tallennetaan…" : "Tallennettu"}
            </span>
            <button type="button" className={smallButtonClass} disabled={usePageEditorStore.getState().past.length === 0} onClick={undo}>
              ↶ Kumoa
            </button>
            <button type="button" className={smallButtonClass} disabled={usePageEditorStore.getState().future.length === 0} onClick={redo}>
              ↷ Tee uudelleen
            </button>
            <button
              type="button"
              className={
                smallButtonClass +
                (previewOnly ? " border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : "")
              }
              aria-pressed={previewOnly}
              onClick={() => setPreviewOnly((value) => !value)}
            >
              {previewOnly ? "Sulje esikatselu" : "Esikatsele"}
            </button>
          </div>
        </div>
        {saveMessage && (
          <p className={"px-4 pb-2 text-xs " + (saveState === "error" ? "text-red-700" : "text-slate-500")}>
            {saveMessage}
          </p>
        )}
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 p-3 sm:p-5 lg:grid-cols-[210px_minmax(0,1fr)_270px]">
        {!previewOnly && (
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Lisää lohko</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Lohko lisätään valitun osion jälkeen.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              {BLOCK_TYPES.map((type) => {
                const block = BLOCK_REGISTRY[type];
                return (
                  <button
                    key={type}
                    type="button"
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left hover:border-slate-400 hover:bg-slate-50"
                    onClick={() => addNewBlock(type)}
                  >
                    <span className="text-lg text-slate-500" aria-hidden="true">{block.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{block.label}</span>
                      <span className="hidden text-xs leading-4 text-slate-500 lg:block">{block.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lohkot</h3>
              <ol className="mt-2 space-y-1">
                {blocks.map((block, index) => (
                  <li key={block.id}>
                    <button
                      type="button"
                      aria-current={block.id === selectedBlockId ? "true" : undefined}
                      className={
                        "flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm " +
                        (block.id === selectedBlockId ? "bg-sky-50 font-semibold text-sky-950" : "text-slate-600 hover:bg-slate-50")
                      }
                      onClick={() => selectBlock(block.id)}
                    >
                      <span className="text-slate-400">{index + 1}</span>
                      <span className="truncate">{BLOCK_REGISTRY[block.type].label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        )}

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-sm font-medium text-slate-700">
              {previewOnly ? "Esikatselu" : "Sivun sisältö"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["mobile", "tablet", "desktop"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    smallButtonClass +
                    (device === mode ? " border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : "")
                  }
                  aria-pressed={device === mode}
                  onClick={() => setDevice(mode)}
                >
                  {mode === "mobile" ? "Puhelin" : mode === "tablet" ? "Tabletti" : "Työpöytä"}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-200 p-2 sm:p-4">
            <div className={"mx-auto min-h-[560px] space-y-4 rounded-xl bg-white p-3 shadow-sm transition-all sm:p-5 " + deviceClass}>
              {blocks.length === 0 ? (
                <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center">
                  <h2 className="font-semibold text-slate-900">Aloita rakentaminen lohkoilla</h2>
                  <p className="mt-2 text-sm text-slate-600">Valitse vasemmalta Hero, teksti, kuva, painike tai sarakkeet.</p>
                </div>
              ) : (
                <>
                  {!previewOnly && (
                    <button
                      type="button"
                      className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-slate-500 hover:bg-slate-50"
                      onClick={() => addNewBlock("text", 0)}
                    >
                      + Lisää lohko sivun alkuun
                    </button>
                  )}
                  {blocks.map((block, index) => (
                    <div key={block.id}>
                      <PreviewBlock
                        block={block}
                        index={index}
                        count={blocks.length}
                        selected={block.id === selectedBlockId}
                        previewOnly={previewOnly}
                        onSelect={() => selectBlock(block.id)}
                        onUpdateRichText={(cellIndex, content) =>
                          updateRichText(block.id, cellIndex, content)
                        }
                        onMove={(offset) => moveBlock(block.id, offset)}
                        onRemove={() => removeBlock(block.id)}
                        onDuplicate={() => duplicateBlock(block)}
                      />
                      {!previewOnly && (
                        <div className="flex justify-center py-1">
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-800"
                            onClick={() => addNewBlock("text", index + 1)}
                          >
                            + Lisää lohko tähän
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </section>

        {!previewOnly && (
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Lohkon asetukset</h2>
            {selectedBlock ? (
              <>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {BLOCK_REGISTRY[selectedBlock.type].description}
                </p>
                <div className="mt-4">
                  <BlockSettings block={selectedBlock} onUpdate={updateSelected} />
                </div>
                <button
                  type="button"
                  className="mt-6 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => selectBlock(null)}
                >
                  Poista valinta
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Valitse lohko esikatselusta tai lohkolistasta muuttaaksesi sen asetuksia.
              </p>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
