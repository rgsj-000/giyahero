"use client";
import { useMemo } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "../../infrastructure/supabase/browser";
import { PublicationReview } from "./publication-review";
import "./marketplace.css";
export function WebPublicationReview() {
  const client = useMemo(() => createBrowserSupabaseClient(), []);
  return (
    <div className="gh-marketplace">
      <main className="gh-market-content">
        <Link href="/">GiyaHero</Link>
        <PublicationReview client={client} />
      </main>
    </div>
  );
}
