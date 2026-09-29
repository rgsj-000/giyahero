"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const supabase = createBrowserSupabaseClient();

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          router.replace("/");
          router.refresh();
          return;
        }

        setSuccessMessage(
          "Check your email to confirm your account, then return to GiyaHero to sign in.",
        );
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace("/");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 sm:py-20">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-emerald-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <Link className="text-xl font-semibold tracking-tight" href="/">
            GiyaHero
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Quezon travel marketplace
            </p>
            <p className="mt-5 max-w-md text-3xl font-semibold leading-tight">
              Find trips from verified travel agencies and keep every request in
              one trusted place.
            </p>
          </div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <Link className="text-lg font-semibold text-emerald-800 lg:hidden" href="/">
            GiyaHero
          </Link>

          <div className="mt-8 lg:mt-0">
            <p className="text-sm font-medium text-emerald-700">
              {isRegister ? "Start planning with confidence" : "Continue your trip planning"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {isRegister ? "Create your GiyaHero account" : "Welcome back"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isRegister
                ? "Create an account when you are ready to save trips or send a booking request."
                : "Sign in to continue saved trips, inquiries, and booking requests."}
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleEmailAuth}>
            {isRegister ? (
              <label className="block text-sm font-medium text-slate-800">
                Full name
                <input
                  autoComplete="name"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  type="text"
                  value={fullName}
                />
              </label>
            ) : null}

            <label className="block text-sm font-medium text-slate-800">
              Email
              <input
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block text-sm font-medium text-slate-800">
              Password
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            {errorMessage ? (
              <p
                aria-live="polite"
                className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p
                aria-live="polite"
                className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                {successMessage}
              </p>
            ) : null}

            <button
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={handleGoogleSignIn}
            type="button"
          >
            Continue with Google
          </button>

          <p className="mt-7 text-center text-sm text-slate-600">
            {isRegister ? "Already have an account?" : "New to GiyaHero?"}{" "}
            <Link
              className="font-semibold text-emerald-700 hover:text-emerald-800"
              href={isRegister ? "/login" : "/register"}
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>

          <p className="mt-4 text-center text-sm">
            <Link className="text-slate-500 hover:text-slate-800" href="/">
              Browse trips without an account
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
