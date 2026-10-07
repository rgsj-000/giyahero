"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useMemo } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Compass, Ticket, Building2 } from "lucide-react";
import { CatalogList } from "./catalog-list";
import { CatalogDetailScreen } from "./catalog-detail";
import { AgencyWorkspace } from "./agency-workspace";
import { BookingScreen } from "../bookings/booking-screen";
import { MyTrips } from "../bookings/my-trips";
import { RequestDetail } from "../bookings/request-detail";
import type { MarketplaceNavigation } from "./navigation";
import "./marketplace.css";
type Screen = {
  name: "browse" | "trips" | "agency";
  packageId?: string;
  agencyId?: string;
  editPackageId?: string;
  editing?: boolean;
  bookingPackageId?: string;
  requestId?: string;
};
function readScreen(): Screen {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("book/"))
    return { name: "browse", bookingPackageId: hash.slice(5) };
  if (hash.startsWith("request/"))
    return { name: "trips", requestId: hash.slice(8) };
  if (hash.startsWith("package/"))
    return { name: "browse", packageId: hash.slice(8) };
  if (hash === "trips") return { name: "trips" };
  if (hash === "agency") return { name: "agency" };
  if (hash.startsWith("agency/")) {
    const parts = hash.split("/");
    return {
      name: "agency",
      agencyId: parts[1],
      editing: parts[2] === "packages",
      editPackageId: parts[3] === "new" ? undefined : parts[3],
    };
  }
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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let active = true;
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          setUser(data.session?.user ?? null);
          setAuthLoading(false);
          if (error) setAuthError(error.message);
        }
      })
      .catch((e) => {
        if (active) {
          setAuthLoading(false);
          setAuthError(String(e));
        }
      });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);
  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }
    setUser(null);
    window.location.hash = "browse";
  }
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
          onClick={() =>
            user ? signOut() : onLogin("/" + window.location.hash)
          }
        >
          {user ? "Sign out" : "Sign in"}
        </button>
      </header>
      <main className="gh-market-content">
        {authError && <p role="alert">{authError}</p>}
        {authLoading &&
        (screen.bookingPackageId ||
          screen.requestId ||
          screen.name === "trips") ? (
          <p role="status">Checking your session…</p>
        ) : screen.bookingPackageId && user ? (
          <BookingScreen
            key={user.id + screen.bookingPackageId}
            client={client}
            packageId={screen.bookingPackageId}
            navigation={nav}
          />
        ) : screen.requestId && user ? (
          <RequestDetail
            key={user.id + screen.requestId}
            client={client}
            requestId={screen.requestId}
          />
        ) : screen.name === "trips" && user ? (
          <MyTrips
            key={user.id}
            client={client}
            onOpenRequest={(id) => {
              window.location.hash = "request/" + id;
            }}
          />
        ) : screen.packageId ? (
          <CatalogDetailScreen
            client={client}
            packageId={screen.packageId}
            navigation={nav}
            onRequest={() => {
              if (user) window.location.hash = "book/" + screen.packageId;
              else onLogin("/#book/" + screen.packageId);
            }}
          />
        ) : screen.name === "browse" && !screen.bookingPackageId ? (
          <CatalogList client={client} navigation={nav} />
        ) : screen.name === "agency" ? (
          <AgencyWorkspace
            client={client}
            agencyId={screen.agencyId}
            packageId={screen.editPackageId}
            editing={screen.editing}
            onLogin={onLogin}
            openExternal={openExternal}
          />
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
              onClick={() => onLogin("/" + window.location.hash)}
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
