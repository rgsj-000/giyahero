"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/infrastructure/supabase/browser";

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AgencyOnboardingForm() {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleAgencyNameChange(value: string) {
    setAgencyName(value);

    if (!slugTouched) {
      setSlug(toSlug(value));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createBrowserSupabaseClient();

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login?next=%2Fagency%2Fonboarding");
        return;
      }

      const { data, error } = await supabase.rpc("create_agency_with_owner", {
        agency_name: agencyName,
        agency_slug: slug,
        agency_legal_name: legalName || null,
        agency_contact_email: contactEmail || null,
        agency_contact_phone: contactPhone || null,
        agency_website_url: website || null,
        agency_description: description || null,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (typeof data !== "string") {
        setErrorMessage("GiyaHero could not create the agency workspace.");
        return;
      }

      router.push(`/agency/${data}/verification`);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link className="text-xl font-semibold text-emerald-900" href="/">
            GiyaHero
          </Link>
          <Link
            className="text-sm font-semibold text-slate-600 hover:text-slate-950"
            href="/login"
          >
            Sign in
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-3xl bg-emerald-950 p-8 text-white sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Agency onboarding
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Register your travel agency
            </h1>
            <p className="mt-4 max-w-md leading-7 text-emerald-50/80">
              Create your agency workspace first. Verification comes next before
              your packages can carry the GiyaHero verified agency badge.
            </p>

            <div className="mt-10 space-y-5 text-sm text-emerald-50/80">
              <p>
                1. Create the agency workspace and become its owner automatically.
              </p>
              <p>
                2. Submit business verification documents through the private
                verification flow.
              </p>
              <p>3. Publish packages after GiyaHero approves the agency.</p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-800">
                  Agency name
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) =>
                      handleAgencyNameChange(event.target.value)
                    }
                    required
                    value={agencyName}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  Legal or business name
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) => setLegalName(event.target.value)}
                    value={legalName}
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-800">
                Public URL slug
                <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
                  <span className="bg-slate-50 px-4 py-3 text-slate-500">
                    /agencies/
                  </span>
                  <input
                    className="min-w-0 flex-1 px-3 py-3 outline-none"
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(toSlug(event.target.value));
                    }}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                    value={slug}
                  />
                </div>
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-800">
                  Contact email
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) => setContactEmail(event.target.value)}
                    type="email"
                    value={contactEmail}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  Contact phone
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    onChange={(event) => setContactPhone(event.target.value)}
                    type="tel"
                    value={contactPhone}
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-800">
                Website
                <input
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="https://"
                  type="url"
                  value={website}
                />
              </label>

              <label className="block text-sm font-medium text-slate-800">
                About your agency
                <textarea
                  className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
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

              <button
                className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? "Creating workspace…"
                  : "Create agency workspace"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
