"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function signOut() {
    setLoading(true);
    setErrorMessage("");
    const { error } = await createClient().auth.signOut();

    if (error) {
      setErrorMessage("Uloskirjautuminen ei onnistunut. Yritä uudelleen.");
      setLoading(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={signOut}
        disabled={loading}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        {loading ? "Kirjaudutaan ulos…" : "Kirjaudu ulos"}
      </button>
      {errorMessage && (
        <p role="status" className="text-xs text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
