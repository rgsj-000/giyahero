import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export function validateReleaseConfig(env) {
  function need(key) {
    const value = env[key]?.trim();
    if (!value) throw new Error("Missing " + key);
    return value;
  }
  function https(key, originOnly = false) {
    const url = new URL(need(key));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      url.search ||
      (originOnly && url.pathname !== "/")
    )
      throw new Error("Invalid HTTPS " + key);
    if (
      /(^|\.)(localhost|test|invalid|example\.com|example\.test)$/.test(
        url.hostname,
      ) ||
      url.hostname.includes("YOUR-")
    )
      throw new Error("Replace example domain in " + key);
    return url;
  }
  const web = https("VITE_WEB_ORIGIN", true),
    supabase = https("VITE_SUPABASE_URL", true),
    callback = https("VITE_AUTH_CALLBACK_URL");
  if (
    callback.origin !== web.origin ||
    callback.pathname !== "/mobile/auth/callback"
  )
    throw new Error(
      "Callback must use the web origin and exact /mobile/auth/callback path.",
    );
  const appId = need("GIYAHERO_APP_ID");
  if (
    !/^([a-z][a-z0-9_]*\.){2,}[a-z][a-z0-9_]*$/.test(appId) ||
    /^(com\.example|YOUR)/.test(appId)
  )
    throw new Error("Use your reserved reverse-domain app identifier.");
  const teamId = need("GIYAHERO_APPLE_TEAM_ID");
  if (!/^[A-Z0-9]{10}$/.test(teamId))
    throw new Error("Invalid Apple team identifier.");
  const fingerprints = need("GIYAHERO_ANDROID_SHA256")
    .split(",")
    .map((v) => v.trim().toUpperCase());
  if (fingerprints.some((v) => !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(v)))
    throw new Error("Use complete Android SHA-256 signing fingerprints.");
  const key = need("VITE_SUPABASE_ANON_KEY");
  let anon = false;
  if (key.startsWith("sb_publishable_") && key.length >= 25) anon = true;
  else
    try {
      anon =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "anon";
    } catch {}
  if (!anon)
    throw new Error(
      "Use a public Supabase publishable/anon key. Never use service-role credentials.",
    );
  if (env.VITE_BROWSER_PREVIEW === "true")
    throw new Error("Disable browser preview for native releases.");
  const environment = need("GIYAHERO_ENVIRONMENT");
  if (!["staging", "production"].includes(environment))
    throw new Error("Choose staging or production.");
  if (environment === "staging" && !appId.endsWith(".staging"))
    throw new Error("Staging must use a distinct .staging app identifier.");
  if (environment === "production" && appId.endsWith(".staging"))
    throw new Error("Production cannot use a staging app identifier.");
  return {
    webOrigin: web.origin,
    supabaseUrl: supabase.origin,
    callbackUrl: callback.href,
    appId,
    appName: need("GIYAHERO_APP_NAME"),
    teamId,
    fingerprints,
    environment,
  };
}
export function linkAssociations(config) {
  return {
    android: [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: config.appId,
          sha256_cert_fingerprints: config.fingerprints,
        },
      },
    ],
    apple: {
      applinks: {
        apps: [],
        details: [
          {
            appID: config.teamId + "." + config.appId,
            paths: ["/mobile/auth/callback"],
          },
        ],
      },
    },
  };
}
export function loadMobileEnv() {
  const path = resolve(import.meta.dirname, "../../mobile/.env.local");
  if (existsSync(path)) process.loadEnvFile(path);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  loadMobileEnv();
  validateReleaseConfig(process.env);
  console.log(
    "Mobile release configuration is valid. Device signing and installed-link checks remain required.",
  );
}
