"use client";
import { useMemo } from "react";
import { createBrowserSupabaseClient } from "../../../infrastructure/supabase/browser";
import { MarketplaceShell } from "../../catalog/marketplace-shell";
export function TravelApp() {
  const client = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);
  if (!client)
    return (
      <main className="gh-marketplace">
        <section className="gh-market-content gh-empty">
          <h1>GiyaHero</h1>
          <p>Travel listings are not available yet. Please check back soon.</p>
          <a href="/login">Sign in</a>
        </section>
      </main>
    );
  return (
    <MarketplaceShell
      client={client}
      onLogin={(returnPath) => {
        window.location.href = "/login?next=" + encodeURIComponent(returnPath);
      }}
      openExternal={(url) => {
        window.location.href = url;
      }}
    />
  );
}
