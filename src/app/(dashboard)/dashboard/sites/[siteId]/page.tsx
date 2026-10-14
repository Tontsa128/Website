import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteTreeEditor } from "@/components/sites/SiteTreeEditor";
import type { PageRow } from "@/lib/pages/tree";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SitePagesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const supabase = await createClient();

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, name, slug, status")
    .eq("id", siteId)
    .maybeSingle();

  if (siteError || !site) notFound();

  const { data: rows, error: pagesError } = await supabase
    .from("pages")
    .select("id, site_id, parent_id, title, slug, position, path, show_in_nav, is_home, status")
    .eq("site_id", siteId)
    .order("position", { ascending: true });

  const pages: PageRow[] = (rows ?? []).map((page) => ({
    id: page.id,
    site_id: page.site_id,
    parent_id: page.parent_id,
    title: page.title,
    slug: page.slug,
    position: page.position,
    path: page.path,
    show_in_nav: page.show_in_nav,
    is_home: page.is_home,
    status: page.status === "published" ? "published" : "draft",
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/dashboard" className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900">
        ← Kaikki sivustot
      </Link>
      <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Sivuston hallinta</p>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {site.name}
          </h1>
          <p className="mt-2 break-all text-sm text-slate-500">Tunniste: {site.slug}</p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
          {site.status === "published" ? "Julkaistu" : "Luonnos"}
        </span>
      </div>

      {pagesError ? (
        <p role="status" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Sivupuun lataaminen epäonnistui. Tarkista yhteys ja yritä uudelleen.
        </p>
      ) : (
        <SiteTreeEditor siteId={siteId} initialPages={pages} />
      )}
    </main>
  );
}
