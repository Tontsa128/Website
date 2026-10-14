"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup" | "forgot-password" | "update-password";
type Feedback = { type: "success" | "error"; message: string };

const modeCopy: Record<
  AuthMode,
  { title: string; description: string; submit: string }
> = {
  login: {
    title: "Kirjaudu sisään",
    description: "Jatka yrityksesi verkkosivujen rakentamista.",
    submit: "Kirjaudu sisään",
  },
  signup: {
    title: "Luo tili",
    description: "Aloita oman verkkosivustosi rakentaminen.",
    submit: "Luo tili",
  },
  "forgot-password": {
    title: "Palauta salasana",
    description: "Lähetämme sähköpostiisi turvallisen palautuslinkin.",
    submit: "Lähetä palautuslinkki",
  },
  "update-password": {
    title: "Aseta uusi salasana",
    description: "Valitse tilillesi uusi, vähintään 8 merkin salasana.",
    submit: "Päivitä salasana",
  },
};

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Toiminto epäonnistui. Yritä uudelleen.";
}

function callbackUrl(nextPath: string): string {
  return (
    window.location.origin +
    "/auth/callback?next=" +
    encodeURIComponent(nextPath)
  );
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const copy = modeCopy[mode];
  const needsEmail = mode !== "update-password";
  const needsPassword = mode !== "forgot-password";
  const needsConfirmation = mode === "update-password";
  const supportsGoogle = mode === "login" || mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (needsConfirmation && password !== confirmPassword) {
      setFeedback({ type: "error", message: "Salasanat eivät täsmää." });
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: callbackUrl("/dashboard") },
        });
        if (error) throw error;

        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        setFeedback({
          type: "success",
          message:
            "Tili luotiin. Tarkista sähköpostisi ja vahvista osoitteesi ennen sisäänkirjautumista.",
        });
        return;
      }

      if (mode === "forgot-password") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: callbackUrl("/reset-password/update") },
        );
        if (error) throw error;
        setFeedback({
          type: "success",
          message:
            "Jos osoitteeseen voidaan lähettää palautusviesti, saat sen hetken kuluttua.",
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setFeedback({
        type: "success",
        message: "Salasana päivitettiin. Voit jatkaa hallintapaneeliin.",
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setFeedback({ type: "error", message: describeError(error) });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setFeedback(null);
    setLoading(true);
    try {
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl("/dashboard"),
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data.url) {
        window.location.assign(data.url);
      } else {
        throw new Error("Google-kirjautumisen osoitetta ei saatu.");
      }
    } catch (error) {
      setFeedback({ type: "error", message: describeError(error) });
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <Link
          href="/"
          className="text-sm font-semibold tracking-wide text-slate-500 hover:text-slate-900"
        >
          Nettisivukone
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {copy.description}
        </p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          {needsEmail && (
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Sähköpostiosoite
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-base outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          )}

          {needsPassword && (
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                {needsConfirmation ? "Uusi salasana" : "Salasana"}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-base outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          )}

          {needsConfirmation && (
            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Vahvista uusi salasana
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-base outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          )}

          {feedback && (
            <p
              role="status"
              aria-live="polite"
              className={
                feedback.type === "error"
                  ? "rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800"
                  : "rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
              }
            >
              {feedback.message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Käsitellään…" : copy.submit}
          </button>
        </form>

        {supportsGoogle && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              TAI
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Jatka Google-tilillä
            </button>
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          {mode === "login" && (
            <>
              <Link
                href="/signup"
                className="font-medium text-slate-900 underline underline-offset-4"
              >
                Luo tili
              </Link>
              <Link href="/forgot-password" className="underline underline-offset-4">
                Unohditko salasanan?
              </Link>
            </>
          )}
          {mode === "signup" && (
            <Link href="/login" className="font-medium underline underline-offset-4">
              Onko sinulla jo tili? Kirjaudu
            </Link>
          )}
          {mode === "forgot-password" && (
            <Link href="/login" className="font-medium underline underline-offset-4">
              Takaisin kirjautumiseen
            </Link>
          )}
          {mode === "update-password" && (
            <Link href="/login" className="font-medium underline underline-offset-4">
              Takaisin kirjautumiseen
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
