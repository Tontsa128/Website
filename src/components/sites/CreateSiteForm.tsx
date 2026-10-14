"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { createSiteAction } from "@/app/(dashboard)/dashboard/actions";

export function CreateSiteForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result = await createSiteAction(name);
    setBusy(false);
    setMessage(result.message);

    if (result.ok && result.id) {
      router.push("/dashboard/sites/" + result.id);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Luo uusi sivusto</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Voit luoda enintään kolme sivustoa. Nimen perusteella muodostetaan sivuston osoitetunniste.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Sivuston nimi</span>
          <input
            name="site-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={60}
            required
            placeholder="Esim. Korjaamo Virtanen"
            className="min-h-12 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-base outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-xl bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Luodaan…" : "Luo sivusto"}
        </button>
      </div>
      {message && (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-700">
          {message}
        </p>
      )}
    </form>
  );
}
