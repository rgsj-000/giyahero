import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  for (const key of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_WEB_ORIGIN",
    "VITE_AUTH_CALLBACK_URL",
  ])
    if (!env[key] || env[key]?.includes("YOUR-"))
      throw new Error("Set " + key + " in mobile/.env.local before building.");
  const origin = new URL(env.VITE_WEB_ORIGIN!);
  const callback = new URL(env.VITE_AUTH_CALLBACK_URL!);
  const supabase = new URL(env.VITE_SUPABASE_URL!);
  if (
    [origin, callback, supabase].some(
      (u) => u.protocol !== "https:" || u.username || u.password,
    ) ||
    origin.href !== origin.origin + "/" ||
    callback.origin !== origin.origin ||
    callback.pathname !== "/mobile/auth/callback" ||
    callback.search ||
    callback.hash
  )
    throw new Error(
      "Use HTTPS Supabase/web origins and the exact /mobile/auth/callback URL.",
    );
  return {
    plugins: [react()],
    publicDir: resolve("../public"),
    server: { port: 5173, strictPort: true, fs: { allow: [resolve("..")] } },
    resolve: { dedupe: ["react", "react-dom"] },
    build: { outDir: "dist", emptyOutDir: true },
  };
});
