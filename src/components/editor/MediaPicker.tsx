"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Choice = {
  id: string;
  filename: string;
  storage_path: string;
  alt_text: string | null;
  signedUrl: string | null;
};

export function MediaPicker({
  siteId,
  selectedIds,
  multiple,
  onChange,
}: {
  siteId: string;
  selectedIds: string[];
  multiple: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [items, setItems] = useState<Choice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadMedia() {
      setLoading(true);
      setErrorMessage("");
      try {
        const supabase = createClient();
        const { data: rows, error } = await supabase
          .from("media")
          .select("id,filename,storage_path,alt_text")
          .eq("site_id", siteId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const paths = (rows ?? []).map((row) => row.storage_path);
        const { data: signedRows, error: signedError } = paths.length
          ? await supabase.storage.from("site-media").createSignedUrls(paths, 3600)
          : { data: [], error: null };

        if (signedError) throw signedError;

        const signedByPath = new Map(
          (signedRows ?? []).map((row) => [row.path, row.signedUrl]),
        );
        const nextItems: Choice[] = (rows ?? []).map((row) => ({
          ...row,
          signedUrl: signedByPath.get(row.storage_path) ?? null,
        }));
        if (active) setItems(nextItems);
      } catch {
        if (active) setErrorMessage("Kuva-arkistoa ei voitu ladata.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMedia();
    return () => {
      active = false;
    };
  }, [siteId]);

  const filteredItems = items.filter((item) =>
    (item.filename + " " + (item.alt_text ?? ""))
      .toLocaleLowerCase("fi-FI")
      .includes(search.toLocaleLowerCase("fi-FI").trim()),
  );

  function toggle(id: string) {
    if (!multiple) {
      onChange(selectedIds.includes(id) ? [] : [id]);
      return;
    }

    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selected) => selected !== id));
    } else if (selectedIds.length < 30) {
      onChange([...selectedIds, id]);
    } else {
      setErrorMessage("Galleriaan voi valita enintään 30 kuvaa.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Valitse kuva-arkistosta
        </h3>
        <span className="text-xs text-slate-500">
          {multiple ? "Valitse enintään 30 kuvaa" : "Valitse yksi kuva"}
        </span>
      </div>
      <label className="mt-3 block">
        <span className="sr-only">Hae kuvia</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Hae tiedostonimellä tai alt-tekstillä"
          className="min-h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      {loading ? (
        <p role="status" className="py-6 text-center text-sm text-slate-500">
          Ladataan kuvia…
        </p>
      ) : errorMessage ? (
        <p role="status" className="py-4 text-sm text-red-700">{errorMessage}</p>
      ) : filteredItems.length === 0 ? (
        <p className="py-6 text-center text-sm leading-6 text-slate-500">
          Kuva-arkisto on tyhjä tai haku ei löytänyt tuloksia. Siirry sivuston media-arkistoon ja lataa kuvia.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filteredItems.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <button
                type="button"
                key={item.id}
                aria-pressed={selected}
                onClick={() => toggle(item.id)}
                className={
                  "min-w-0 overflow-hidden rounded-xl border text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 " +
                  (selected
                    ? "border-sky-600 bg-sky-50 ring-2 ring-sky-100"
                    : "border-slate-200 hover:border-slate-400")
                }
              >
                <div className="aspect-[4/3] bg-slate-100">
                  {item.signedUrl ? (
                    // Signed private URL. It is not a public asset URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.signedUrl}
                      alt={item.alt_text ?? ""}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl text-slate-400">▧</div>
                  )}
                </div>
                <span className="block truncate px-2 py-2 text-xs font-medium text-slate-800">
                  {selected ? "✓ " : ""}{item.filename}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
