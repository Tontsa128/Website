"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChangeEvent, DragEvent, FormEvent } from "react";

import {
  createMediaFolderAction,
  deleteMediaAction,
  deleteMediaFolderAction,
  renameMediaFolderAction,
  updateMediaMetadataAction,
} from "@/app/(dashboard)/dashboard/sites/[siteId]/media/actions";
import type { MediaApiResponse, MediaAsset, MediaFolder, SupportedSourceMime } from "@/lib/media/types";
import {
  getExtensionForMime,
  MAX_MEDIA_UPLOAD_BYTES,
  isSupportedSourceMime,
} from "@/lib/media/validation";
import { createClient } from "@/lib/supabase/client";

type MediaLibraryManagerProps = {
  siteId: string;
  initialAssets: MediaAsset[];
  folders: MediaFolder[];
};

function bytesLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " kt";
  return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " Mt";
}

function getPayload(value: unknown): MediaApiResponse | null {
  if (typeof value !== "object" || value === null) return null;
  return value as MediaApiResponse;
}

export function MediaLibraryManager({
  siteId,
  initialAssets,
  folders: initialFolders,
}: MediaLibraryManagerProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState(initialAssets);
  const [folders, setFolders] = useState(initialFolders);
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [uploadFolder, setUploadFolder] = useState("");
  const [folderName, setFolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => setAssets(initialAssets), [initialAssets]);
  useEffect(() => setFolders(initialFolders), [initialFolders]);

  const filteredAssets = assets.filter((asset) => {
    const folderMatches =
      selectedFolder === "all" ||
      (selectedFolder === "none" ? !asset.folder_id : asset.folder_id === selectedFolder);
    const term = search.trim().toLocaleLowerCase("fi-FI");
    const searchMatches =
      !term ||
      (asset.filename + " " + (asset.alt_text ?? "") + " " + asset.tags.join(" "))
        .toLocaleLowerCase("fi-FI")
        .includes(term);
    return folderMatches && searchMatches;
  });

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setBusy(true);
    setUploadMessage("");
    setStatusMessage("");

    let uploadedCount = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file) continue;

      if (!isSupportedSourceMime(file.type)) {
        setUploadMessage(
          "Tiedostoa " + file.name + " ei hyväksytty. Käytä JPEG-, PNG- tai WebP-kuvaa.",
        );
        continue;
      }
      if (file.size === 0 || file.size > MAX_MEDIA_UPLOAD_BYTES) {
        setUploadMessage("Tiedoston " + file.name + " koko saa olla enintään 10 MB.");
        continue;
      }

      const mime = file.type as SupportedSourceMime;
      const extension = getExtensionForMime(mime);
      if (!extension) {
        setUploadMessage("Tiedoston tyyppi ei ole sallittu.");
        continue;
      }

      setUploadMessage("Ladataan kuvaa " + (index + 1) + " / " + files.length + ": " + file.name);
      const uploadPath = siteId + "/" + crypto.randomUUID() + extension;

      try {
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("site-media-inbox")
          .upload(uploadPath, file, {
            contentType: mime,
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setUploadMessage("Alkuperäisen kuvan lataus epäonnistui: " + file.name);
          continue;
        }

        const response = await fetch("/api/media/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId,
            uploadPath,
            sourceMime: mime,
            originalFilename: file.name,
            folderId: uploadFolder || null,
            altText: "",
          }),
        });

        let value: unknown = null;
        try {
          value = await response.json();
        } catch {
          value = null;
        }
        const payload = getPayload(value);

        if (!response.ok || !payload?.media) {
          await supabase.storage.from("site-media-inbox").remove([uploadPath]);
          setUploadMessage(
            payload?.error || "Kuvaa ei voitu käsitellä. Tarkista tiedosto ja yritä uudelleen.",
          );
          continue;
        }

        const newAsset: MediaAsset = {
          ...payload.media,
          signedUrl: payload.signedUrl ?? null,
          usageCount: 0,
        };
        setAssets((current) => [newAsset, ...current.filter((asset) => asset.id !== newAsset.id)]);
        uploadedCount += 1;
      } catch {
        setUploadMessage("Kuvan lataus epäonnistui. Tarkista verkkoyhteys ja yritä uudelleen.");
      }
    }

    setBusy(false);
    if (uploadedCount > 0) {
      setUploadMessage(uploadedCount + " kuvaa ladattiin ja muunnettiin WebP-muotoon.");
      router.refresh();
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    if (list) await uploadFiles(list);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    await uploadFiles(event.dataTransfer.files);
  }

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("");
    const result = await createMediaFolderAction(siteId, folderName);
    setStatusMessage(result.message);

    if (result.ok && result.id) {
      setFolderName("");
      router.refresh();
    }
  }

  async function renameFolder(folder: MediaFolder) {
    const nextName = window.prompt("Anna kansiolle uusi nimi", folder.name);
    if (nextName === null) return;
    const result = await renameMediaFolderAction(folder.id, nextName);
    setStatusMessage(result.message);
    if (result.ok) router.refresh();
  }

  async function removeFolder(folder: MediaFolder) {
    const confirmed = window.confirm(
      "Poistetaanko kansio " + folder.name + "? Sen kuvat säilyvät kuva-arkistossa.",
    );
    if (!confirmed) return;
    const result = await deleteMediaFolderAction(folder.id);
    setStatusMessage(result.message);
    if (result.ok) {
      if (selectedFolder === folder.id) setSelectedFolder("all");
      if (uploadFolder === folder.id) setUploadFolder("");
      router.refresh();
    }
  }

  async function saveMetadata(asset: MediaAsset) {
    const tagInput = (asset.tags ?? []).join(", ");
    const result = await updateMediaMetadataAction(
      asset.id,
      asset.alt_text ?? "",
      asset.folder_id,
      tagInput.split(",").map((tag) => tag.trim()).filter(Boolean),
    );
    setStatusMessage(result.message);
    if (result.ok) router.refresh();
  }

  function updateAsset(assetId: string, updater: (asset: MediaAsset) => MediaAsset) {
    setAssets((current) =>
      current.map((asset) => (asset.id === assetId ? updater(asset) : asset)),
    );
  }

  async function removeAsset(asset: MediaAsset) {
    const confirmed = window.confirm(
      "Poistetaanko kuva " + asset.filename + "? Käytössä olevia kuvia ei voi poistaa.",
    );
    if (!confirmed) return;
    const result = await deleteMediaAction(asset.id);
    setStatusMessage(result.message);
    if (result.ok) {
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      router.refresh();
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Lataa kuvia</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              JPEG-, PNG- ja WebP-kuvat käsitellään palvelimella WebP-muotoon. Yhden alkuperäiskuvan enimmäiskoko on 10 MB. Animoituja kuvia ja SVG-tiedostoja ei hyväksytä.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
            <span>Kohdekansio</span>
            <select
              value={uploadFolder}
              onChange={(event) => setUploadFolder(event.target.value)}
              className="min-h-10 max-w-48 rounded-lg border border-slate-300 px-2 py-1"
            >
              <option value="">Ei kansiota</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(event) => { void handleDrop(event); }}
          className={
            "mt-4 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition sm:py-10 " +
            (dragging ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-slate-50")
          }
        >
          <span aria-hidden="true" className="text-3xl text-slate-400">▧</span>
          <p className="mt-2 font-medium text-slate-900">Pudota kuvat tähän</p>
          <p className="mt-1 text-sm text-slate-500">Tai valitse kuvat puhelimesta tai tietokoneelta.</p>
          <input
            ref={fileInput}
            id="media-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => { void handleFileChange(event); }}
            disabled={busy}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Käsitellään kuvia…" : "Valitse kuvat"}
          </button>
          {uploadMessage && (
            <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-700">
              {uploadMessage}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Kansiot</h2>
        <form onSubmit={(event) => { void createFolder(event); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Uuden kansion nimi</span>
            <input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              required
              minLength={1}
              maxLength={50}
              placeholder="Uuden kansion nimi"
              className="min-h-11 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base"
            />
          </label>
          <button type="submit" className="min-h-11 rounded-xl border border-slate-300 px-4 font-medium text-slate-800 hover:bg-slate-50">
            Luo kansio
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={selectedFolder === "all"}
            onClick={() => setSelectedFolder("all")}
            className={"min-h-10 rounded-full border px-4 py-2 text-sm " + (selectedFolder === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700")}
          >
            Kaikki kuvat ({assets.length})
          </button>
          <button
            type="button"
            aria-pressed={selectedFolder === "none"}
            onClick={() => setSelectedFolder("none")}
            className={"min-h-10 rounded-full border px-4 py-2 text-sm " + (selectedFolder === "none" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700")}
          >
            Ei kansiota
          </button>
          {folders.map((folder) => (
            <div key={folder.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 pl-3">
              <button
                type="button"
                aria-pressed={selectedFolder === folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={"min-h-10 py-2 text-sm " + (selectedFolder === folder.id ? "font-semibold text-slate-950" : "text-slate-700")}
              >
                {folder.name}
              </button>
              <button type="button" onClick={() => void renameFolder(folder)} aria-label={"Nimeä kansio " + folder.name} className="min-h-9 min-w-9 rounded-full text-sm text-slate-500 hover:bg-slate-100">✎</button>
              <button type="button" onClick={() => void removeFolder(folder)} aria-label={"Poista kansio " + folder.name} className="min-h-9 min-w-9 rounded-full text-sm text-red-700 hover:bg-red-50">×</button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Kuva-arkisto</h2>
            <p className="mt-1 text-sm text-slate-600">{filteredAssets.length} kuvaa näkyvissä. Kuvia ei voi poistaa silloin, kun ne ovat sivujen luonnoksissa tai julkaistussa sisällössä.</p>
          </div>
          <label className="block sm:w-80">
            <span className="sr-only">Hae kuva-arkistosta</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hae nimeä, alt-tekstiä tai tagia"
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base"
            />
          </label>
        </div>

        {statusMessage && (
          <p role="status" aria-live="polite" className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {statusMessage}
          </p>
        )}

        {filteredAssets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
            <span aria-hidden="true" className="text-4xl text-slate-400">▧</span>
            <h3 className="mt-3 font-semibold text-slate-900">Kuvia ei löytynyt</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">Lataa ensimmäinen kuva tai muuta hakua ja kansiosuodatinta.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAssets.map((asset) => (
              <article key={asset.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="aspect-[4/3] bg-slate-100">
                  {asset.signedUrl ? (
                    // Signed URL belongs to a private bucket and expires automatically.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.signedUrl}
                      alt={asset.alt_text ?? ""}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl text-slate-400">▧</div>
                  )}
                </div>

                <div className="space-y-4 p-4">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-slate-900">{asset.filename}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {asset.width ?? "—"} × {asset.height ?? "—"} px · {bytesLabel(asset.size_bytes)} · WebP
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Käytössä {asset.usageCount ?? 0} sivulla
                    </p>
                  </div>

                  <label className="block text-sm font-medium text-slate-700">
                    Alt-teksti
                    <textarea
                      value={asset.alt_text ?? ""}
                      maxLength={500}
                      onChange={(event) => updateAsset(asset.id, (current) => ({ ...current, alt_text: event.target.value }))}
                      placeholder="Kuvaile kuvan sisältöä ruudunlukijaa ja hakukoneita varten"
                      className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                    />
                    {!asset.alt_text?.trim() && (
                      <span className="mt-1 block text-xs font-normal text-amber-800">Alt-teksti puuttuu.</span>
                    )}
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Kansio
                    <select
                      value={asset.folder_id ?? ""}
                      onChange={(event) => updateAsset(asset.id, (current) => ({ ...current, folder_id: event.target.value || null }))}
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
                    >
                      <option value="">Ei kansiota</option>
                      {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Tagit
                    <input
                      value={asset.tags.join(", ")}
                      onChange={(event) => updateAsset(asset.id, (current) => ({
                        ...current,
                        tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
                      }))}
                      placeholder="esim. etusivu, palvelut"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void saveMetadata(asset)} className="min-h-10 flex-1 rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                      Tallenna tiedot
                    </button>
                    <button type="button" onClick={() => void removeAsset(asset)} className="min-h-10 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                      Poista
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
