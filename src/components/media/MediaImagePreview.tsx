"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function MediaImagePreview({
  siteId,
  mediaId,
  altText,
  caption,
}: {
  siteId: string;
  mediaId: string | null;
  altText: string;
  caption?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadImage() {
      setSrc(null);
      setFailed(false);
      if (!mediaId) return;

      try {
        const supabase = createClient();
        const { data: media, error: mediaError } = await supabase
          .from("media")
          .select("storage_path,site_id")
          .eq("id", mediaId)
          .eq("site_id", siteId)
          .maybeSingle();

        if (mediaError || !media) {
          if (active) setFailed(true);
          return;
        }

        const { data, error } = await supabase.storage
          .from("site-media")
          .createSignedUrl(media.storage_path, 3600);

        if (active) {
          if (error || !data?.signedUrl) setFailed(true);
          else setSrc(data.signedUrl);
        }
      } catch {
        if (active) setFailed(true);
      }
    }

    void loadImage();
    return () => {
      active = false;
    };
  }, [mediaId, siteId]);

  if (!mediaId || failed || !src) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 py-8 text-center text-slate-500">
          <span aria-hidden="true" className="text-4xl">▧</span>
          <p className="font-medium text-slate-700">
            {mediaId ? "Kuvaa ei voitu ladata" : "Valitse kuva kuva-arkistosta"}
          </p>
          {altText && <p className="max-w-sm text-sm">{altText}</p>}
        </div>
        {caption && (
          <figcaption className="border-t border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-600">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <figure className="overflow-hidden rounded-2xl bg-white">
      {/* The signed URL is private and short-lived, so no public image optimization host is configured. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={altText}
        loading="lazy"
        className="h-auto max-h-[640px] w-full object-contain"
      />
      {caption && (
        <figcaption className="border-t border-slate-200 px-4 py-3 text-center text-sm text-slate-600">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
