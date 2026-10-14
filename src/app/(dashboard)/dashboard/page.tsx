export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
        Hallintapaneeli
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        Tervetuloa nettisivukoneeseen
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-600">
        Kirjautuminen on käytössä. Seuraavassa vaiheessa lisätään sivuston luonti,
        sivulista ja sivupuun hallinta.
      </p>
      <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Sivustosi</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sinulla ei vielä ole hallittavia sivustoja. Sivuston luonti avataan vaiheessa 2.
        </p>
      </section>
    </main>
  );
}
