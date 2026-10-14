"use client";

import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  copyPageAction,
  createPageAction,
  deletePageAction,
  movePageAction,
  renamePageAction,
  setHomePageAction,
} from "@/app/(dashboard)/dashboard/actions";
import {
  buildPageTree,
  canMovePage,
  flattenPageTree,
  type PageRow,
  type PageTreeNode,
} from "@/lib/pages/tree";

type ActionResponse = {
  ok: boolean;
  message: string;
  id?: string;
};

function RootDropTarget() {
  const { ref } = useDroppable({ id: "root-drop" });
  return (
    <div
      ref={ref}
      className="mb-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600"
    >
      Pudota tähän, jos haluat siirtää sivun juuritasolle.
    </div>
  );
}

function PageTreeItem({
  page,
  siteId,
  allPages,
  onMove,
}: {
  page: PageTreeNode;
  siteId: string;
  allPages: PageRow[];
  onMove: (pageId: string, parentId: string | null, position: number) => Promise<void>;
}) {
  const router = useRouter();
  const { ref: dragRef } = useDraggable({ id: "page-drag-" + page.id });
  const { ref: dropRef } = useDroppable({ id: "page-drop-" + page.id });
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [childTitle, setChildTitle] = useState("Uusi alasivu");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function runAction(action: Promise<ActionResponse>) {
    setBusy(true);
    setMessage("");
    const result = await action;
    setBusy(false);
    setMessage(result.message);
    if (result.ok) router.refresh();
  }

  async function saveTitle() {
    await runAction(renamePageAction(page.id, title));
    setEditing(false);
  }

  async function addChild() {
    if (!childTitle.trim()) {
      setMessage("Anna alasivulle nimi.");
      return;
    }
    await runAction(createPageAction(siteId, page.id, childTitle));
    setAddingChild(false);
    setChildTitle("Uusi alasivu");
  }

  async function copyPage() {
    await runAction(copyPageAction(page.id));
  }

  async function removePage() {
    const confirmed = window.confirm(
      "Poistetaanko sivu ja kaikki sen alasivut? Toimintoa ei voi perua.",
    );
    if (!confirmed) return;
    await runAction(deletePageAction(page.id));
  }

  return (
    <li className="min-w-0">
      <div
        ref={dropRef}
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div className="flex flex-wrap items-start gap-2">
          <button
            ref={dragRef}
            type="button"
            aria-label={"Vedä sivu " + page.title + " toisen sivun päälle siirtääksesi sen alasivuksi"}
            title="Vedä sivu toisen sivun päälle"
            className="min-h-10 min-w-10 touch-none rounded-lg border border-slate-200 px-2 text-lg text-slate-600 hover:bg-slate-100"
          >
            ↕
          </button>

          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Sivun uusi nimi"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-base"
                />
                <button type="button" onClick={() => void saveTitle()} disabled={busy} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                  Tallenna
                </button>
                <button type="button" onClick={() => { setEditing(false); setTitle(page.title); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  Peruuta
                </button>
              </div>
            ) : (
              <>
                <p className="break-words font-medium text-slate-900">{page.title}</p>
                <p className="mt-0.5 break-all text-xs text-slate-500">/{page.path}</p>
              </>
            )}
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{page.status === "published" ? "Julkaistu" : "Luonnos"}</span>
              {page.is_home && <span>Etusivu</span>}
              {!page.show_in_nav && <span>Piilotettu valikosta</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { setEditing((value) => !value); setTitle(page.title); }} disabled={busy} className="min-h-10 rounded-lg border border-slate-200 px-2.5 text-sm hover:bg-slate-50 disabled:opacity-60">
              Nimeä
            </button>
            <button type="button" onClick={() => setAddingChild((value) => !value)} disabled={busy} className="min-h-10 rounded-lg border border-slate-200 px-2.5 text-sm hover:bg-slate-50 disabled:opacity-60">
              + Alasivu
            </button>
            <button type="button" onClick={() => void copyPage()} disabled={busy} className="min-h-10 rounded-lg border border-slate-200 px-2.5 text-sm hover:bg-slate-50 disabled:opacity-60">
              Kopioi
            </button>
            {!page.is_home && (
              <button type="button" onClick={() => void runAction(setHomePageAction(page.id))} disabled={busy} className="min-h-10 rounded-lg border border-slate-200 px-2.5 text-sm hover:bg-slate-50 disabled:opacity-60">
                Aseta etusivuksi
              </button>
            )}
            <button type="button" onClick={() => void onMove(page.id, page.parent_id, Math.max(0, page.position - 1))} disabled={busy || page.position === 0} aria-label={"Siirrä " + page.title + " ylöspäin"} className="min-h-10 min-w-10 rounded-lg border border-slate-200 px-2 text-sm hover:bg-slate-50 disabled:opacity-40">
              ↑
            </button>
            <button type="button" onClick={() => void onMove(page.id, page.parent_id, page.position + 1)} disabled={busy} aria-label={"Siirrä " + page.title + " alaspäin"} className="min-h-10 min-w-10 rounded-lg border border-slate-200 px-2 text-sm hover:bg-slate-50 disabled:opacity-40">
              ↓
            </button>
            <button type="button" onClick={() => void removePage()} disabled={busy} className="min-h-10 rounded-lg border border-red-200 px-2.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60">
              Poista
            </button>
          </div>
        </div>

        {addingChild && (
          <form
            className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row"
            onSubmit={(event) => { event.preventDefault(); void addChild(); }}
          >
            <input
              aria-label="Alasivun nimi"
              value={childTitle}
              onChange={(event) => setChildTitle(event.target.value)}
              maxLength={80}
              required
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-base"
            />
            <button type="submit" disabled={busy} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
              Lisää alasivu
            </button>
          </form>
        )}
        {message && (
          <p role="status" aria-live="polite" className="mt-2 text-sm text-slate-600">
            {message}
          </p>
        )}
      </div>

      {page.children.length > 0 && (
        <ul className="ml-3 mt-2 space-y-2 border-l-2 border-slate-200 pl-3 sm:ml-5 sm:pl-4">
          {page.children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              siteId={siteId}
              allPages={allPages}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SiteTreeEditor({
  siteId,
  initialPages,
}: {
  siteId: string;
  initialPages: PageRow[];
}) {
  const router = useRouter();
  const [rootTitle, setRootTitle] = useState("Uusi sivu");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const tree = useMemo(() => buildPageTree(initialPages), [initialPages]);
  const allPages = useMemo(() => flattenPageTree(tree), [tree]);

  async function addRootPage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const result = await createPageAction(siteId, null, rootTitle);
    setBusy(false);
    setNotice(result.message);
    if (result.ok) {
      setRootTitle("Uusi sivu");
      router.refresh();
    }
  }

  async function handleMove(pageId: string, parentId: string | null, position: number) {
    if (!canMovePage(allPages, pageId, parentId)) {
      setNotice("Sivua ei voi siirtää oman alipuunsa alle tai toiseen sivustoon.");
      return;
    }

    setBusy(true);
    setNotice("");
    const result = await movePageAction(pageId, parentId, position);
    setBusy(false);
    setNotice(result.message);
    if (result.ok) router.refresh();
  }

  async function handleDrop(sourceId: string, targetId: string, canceled: boolean) {
    if (canceled) return;

    if (!sourceId.startsWith("page-drag-")) return;
    const pageId = sourceId.slice("page-drag-".length);
    const page = allPages.find((item) => item.id === pageId);
    if (!page) return;

    if (targetId === "root-drop") {
      const rootCount = allPages.filter(
        (item) => item.parent_id === null && item.id !== pageId,
      ).length;
      await handleMove(pageId, null, rootCount);
      return;
    }

    if (!targetId.startsWith("page-drop-")) return;
    const parentId = targetId.slice("page-drop-".length);
    const parent = allPages.find((item) => item.id === parentId);
    if (!parent) return;

    const childCount = allPages.filter(
      (item) => item.parent_id === parentId && item.id !== pageId,
    ).length;
    await handleMove(pageId, parentId, childCount);
  }

  return (
    <section className="mt-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Sivupuu</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Luo sivuja ja alasivuja. Vedä sivun ↕-kahvasta toisen sivun päälle tehdäksesi siitä alasivun. Nuolipainikkeet toimivat myös ilman vetämistä.
        </p>
        <form onSubmit={(event) => void addRootPage(event)} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="Uuden juurisivun nimi"
            value={rootTitle}
            onChange={(event) => setRootTitle(event.target.value)}
            maxLength={80}
            required
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-base"
          />
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60">
            + Lisää juurisivu
          </button>
        </form>
        {notice && <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-700">{notice}</p>}
      </div>

      <DragDropProvider onDragEnd={(event) => { void handleDrop(String(event.operation.source.id), event.operation.target ? String(event.operation.target.id) : "", event.canceled); }}>
        <RootDropTarget />
        {tree.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
            <p className="font-medium text-slate-800">Sivustolla ei ole vielä sivuja.</p>
            <p className="mt-1 text-sm text-slate-600">Lisää ensimmäinen juurisivu yllä olevalla kentällä.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tree.map((page) => (
              <PageTreeItem
                key={page.id}
                page={page}
                siteId={siteId}
                allPages={allPages}
                onMove={handleMove}
              />
            ))}
          </ul>
        )}
      </DragDropProvider>

      <div className="mt-6">
        <Link href="/dashboard" className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900">
          ← Takaisin sivustoihin
        </Link>
      </div>
    </section>
  );
}
