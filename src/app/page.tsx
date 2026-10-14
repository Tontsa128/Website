import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 py-16 sm:px-6">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Nettisivukone
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            Rakenna yrityksesi verkkosivut itse — selkeästi ja tekoälyn avulla.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Luo yrityksellesi verkkosivusto ilman koodaamista. Sivukone rakentuu vaiheittain
            turvalliseksi, mobiilissa toimivaksi palveluksi.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
            >
              Luo ilmainen tili
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-800 transition hover:bg-slate-100"
            >
              Kirjaudu sisään
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2">Next.js</span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2">Supabase Auth</span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2">TypeScript</span>
          </div>
        </div>
      </section>
    </main>
  );
}
