import { useEffect, useState } from "react";
import { App as NativeApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MarketplaceShell } from "../../src/features/catalog/marketplace-shell";
import { AuthScreen } from "./auth/auth-screen";
import { createNativeSupabaseClient } from "./auth/native-client";
import type { SessionStorage } from "./auth/secure-storage";
import { createAuthLinkHandler, safeReturnPath } from "./auth/auth-links";
import { returnToMarketplace, openHostedPage } from "./navigation";
export function App() {
  const [runtime, setRuntime] = useState<{
    client: SupabaseClient;
    storage: SessionStorage;
  } | null>(null);
  const [fatal, setFatal] = useState("");
  const [authError, setAuthError] = useState("");
  const [authVisible, setAuthVisible] = useState(
    window.location.hash === "#auth",
  );
  useEffect(() => {
    const change = () => setAuthVisible(window.location.hash === "#auth");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    let active = true;
    const handles: PluginListenerHandle[] = [];
    let client: SupabaseClient | undefined;
    (async () => {
      const ready = await createNativeSupabaseClient();
      client = ready.client;
      if (!active) {
        client.auth.stopAutoRefresh();
        return;
      }
      setRuntime(ready);
      const complete = async () => {
        const path = await ready.storage.getItem("return-path");
        await ready.storage.removeItem("return-path");
        if (active) {
          setAuthError("");
          returnToMarketplace(path);
        }
      };
      const handle = createAuthLinkHandler(
        import.meta.env.VITE_AUTH_CALLBACK_URL,
        async (code) => {
          const { error } =
            await ready.client.auth.exchangeCodeForSession(code);
          if (error)
            throw new Error(
              "This sign-in link could not be completed on this device. Sign in with your password or start Google sign-in again.",
            );
        },
        async () => {
          await complete();
          try {
            await Browser.close();
          } catch {
            /* Android browser closes when the app link opens. */
          }
        },
      );
      const link = async (url: string) => {
        try {
          await handle(url);
        } catch (e) {
          if (active) {
            setAuthError(
              e instanceof Error ? e.message : "Sign-in link failed.",
            );
            window.location.hash = "auth";
          }
        }
      };
      if (Capacitor.isNativePlatform()) {
        handles.push(
          await NativeApp.addListener("appUrlOpen", ({ url }) => {
            void link(url);
          }),
        );
        handles.push(
          await NativeApp.addListener("appStateChange", ({ isActive }) => {
            if (isActive) ready.client.auth.startAutoRefresh();
            else ready.client.auth.stopAutoRefresh();
          }),
        );
        handles.push(
          await NativeApp.addListener("backButton", () => {
            if (window.location.hash && window.location.hash !== "#browse") {
              window.history.back();
            } else void NativeApp.exitApp();
          }),
        );
        const launch = await NativeApp.getLaunchUrl();
        if (launch) await link(launch.url);
      }
      if (!active) {
        await Promise.all(handles.map((h) => h.remove()));
        ready.client.auth.stopAutoRefresh();
      }
    })().catch((e) => {
      if (active)
        setFatal(
          e instanceof Error ? e.message : "The mobile app could not start.",
        );
    });
    return () => {
      active = false;
      for (const handle of handles) void handle.remove();
      client?.auth.stopAutoRefresh();
    };
  }, []);
  async function authenticated() {
    if (!runtime) return;
    const path = await runtime.storage.getItem("return-path");
    await runtime.storage.removeItem("return-path");
    returnToMarketplace(path);
  }
  async function login(path: string) {
    if (!runtime) return;
    try {
      await runtime.storage.setItem("return-path", safeReturnPath(path));
      setAuthError("");
      window.location.hash = "auth";
    } catch (e) {
      setFatal(
        e instanceof Error
          ? e.message
          : "Could not store the sign-in return path.",
      );
    }
  }
  if (fatal)
    return (
      <main className="gh-auth">
        <h1>GiyaHero could not start</h1>
        <p role="alert">{fatal}</p>
        <button className="gh-action" onClick={() => window.location.reload()}>
          Retry
        </button>
      </main>
    );
  if (!runtime)
    return (
      <main className="gh-auth">
        <h1>GiyaHero</h1>
        <p role="status">Restoring your session…</p>
      </main>
    );
  return (
    <>
      {!Capacitor.isNativePlatform() && (
        <div className="gh-native-notice">
          Browser preview · installed apps use secure device storage
        </div>
      )}
      {authVisible ? (
        <AuthScreen
          client={runtime.client}
          onAuthenticated={authenticated}
          error={authError}
          onClose={() => returnToMarketplace("/#browse")}
        />
      ) : (
        <MarketplaceShell
          client={runtime.client}
          onLogin={(path) => {
            void login(path);
          }}
          openExternal={(path) => {
            void openHostedPage(path).catch((e) => setFatal(e.message));
          }}
        />
      )}
    </>
  );
}
