import Link from "next/link";

import { CreateSiteForm } from "@/components/sites/CreateSiteForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
        Hallintapaneeli
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        Sivustosi
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">
        Hallitse yrityksesi sivustoja ja niiden sivurakennetta yhdestä paikasta.
      </p>

      <div className="mt-8">
        <CreateSiteForm />
      </div>

      {error ? (
        <p role="status" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Sivustoja ei saatu ladattua. Tarkista Supabase-asetukset ja yritä uudelleen.
        </p>
      ) : (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Omat sivustot</h2>
            <p className="text-sm text-slate-500">{sites?.length ?? 0} / 3</p>
          </div>
          {!sites || sites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="font-medium text-slate-900">Aloita ensimmäisestä sivustosta</h3>
              <p className="mt-2 text-sm text-slate-600">Anna nimi yllä olevaan kenttään. Sivujen luonti ja alasivut löytyvät sivuston hallinnasta.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => (
                <Link
                  key={site.id}
                  href={"/dashboard/sites/" + site.id}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="break-words font-semibold text-slate-900 group-hover:underline">
                      {site.name}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      {site.status === "published" ? "Julkaistu" : "Luonnos"}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-sm text-slate-500">Osoitetunniste: {site.slug}</p>
                  <p className="mt-5 text-sm font-medium text-slate-800">Hallitse sivuja →</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
