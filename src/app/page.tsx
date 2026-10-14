export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Nettisivukone
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            Rakenna yrityksesi verkkosivut itse — selkeästi ja tekoälyn avulla.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Vaihe 0 rakentaa teknisen perustan turvalliselle sivukoneelle. Varsinaiset
            kirjautumis-, sivupuu- ja editoriominaisuudet tulevat omissa vaiheissaan.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
              Next.js
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
              TypeScript strict
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
              Tailwind CSS
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
              Vitest
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
