"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Compass, Ticket, Building2 } from "lucide-react";
import { CatalogList } from "./catalog-list";
import { CatalogDetailScreen } from "./catalog-detail";
import type { MarketplaceNavigation } from "./navigation";
import "./marketplace.css";
type Screen = { name: "browse" | "trips" | "agency"; packageId?: string };
function readScreen(): Screen {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("package/"))
    return { name: "browse", packageId: hash.slice(8) };
  if (hash === "trips") return { name: "trips" };
  if (hash === "agency") return { name: "agency" };
  return { name: "browse" };
}
export function MarketplaceShell({
  client,
  openExternal,
  onLogin,
}: {
  client: SupabaseClient;
  openExternal: (url: string) => void;
  onLogin: (returnPath: string) => void;
}) {
  const [screen, setScreen] = useState<Screen>({ name: "browse" });
  useEffect(() => {
    const update = () => {
      setScreen(readScreen());
      window.scrollTo(0, 0);
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const nav = useMemo<MarketplaceNavigation>(
    () => ({
      openPackage: (id) => {
        window.location.hash = "package/" + id;
      },
      openTrips: () => {
        window.location.hash = "trips";
      },
      requireLogin: onLogin,
      openAgencyWorkspace: (agencyId) =>
        openExternal("/agency/" + agencyId + "/packages"),
    }),
    [onLogin, openExternal],
  );
  return (
    <div className="gh-marketplace">
      <header className="gh-market-header">
        <a href="#browse" aria-label="GiyaHero home">
          <img src="/images/logo.webp" alt="GiyaHero" />
        </a>
        <button
          className="gh-action gh-secondary"
          onClick={() => onLogin("/" + window.location.hash)}
        >
          Sign in
        </button>
      </header>
      <main className="gh-market-content">
        {screen.packageId ? (
          <CatalogDetailScreen
            client={client}
            packageId={screen.packageId}
            navigation={nav}
            onRequest={() => onLogin("/#package/" + screen.packageId)}
          />
        ) : screen.name === "browse" ? (
          <CatalogList client={client} navigation={nav} />
        ) : (
          <section className="gh-empty">
            <h1>{screen.name === "trips" ? "My Trips" : "Agency workspace"}</h1>
            <p>
              Sign in to manage your{" "}
              {screen.name === "trips"
                ? "booking requests"
                : "agency packages and booking requests"}
              .
            </p>
            <button
              className="gh-action gh-orange"
              onClick={() => onLogin("/#" + screen.name)}
            >
              Sign in to continue
            </button>
          </section>
        )}
      </main>
      <nav className="gh-bottom-nav" aria-label="Main navigation">
        <a
          href="#browse"
          aria-current={screen.name === "browse" ? "page" : undefined}
        >
          <Compass aria-hidden="true" />
          Explore
        </a>
        <a
          href="#trips"
          aria-current={screen.name === "trips" ? "page" : undefined}
        >
          <Ticket aria-hidden="true" />
          My Trips
        </a>
        <a
          href="#agency"
          aria-current={screen.name === "agency" ? "page" : undefined}
        >
          <Building2 aria-hidden="true" />
          Agency
        </a>
      </nav>
    </div>
  );
}
