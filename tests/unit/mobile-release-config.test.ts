import { expect, it } from "vitest";
import {
  validateReleaseConfig,
  linkAssociations,
} from "../../scripts/mobile/check-release-config.mjs";
const env = {
  GIYAHERO_ENVIRONMENT: "staging",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_real_staging_key",
  VITE_WEB_ORIGIN: "https://staging.giyahero.ph",
  VITE_AUTH_CALLBACK_URL: "https://staging.giyahero.ph/mobile/auth/callback",
  GIYAHERO_APP_ID: "ph.giyahero.app.staging",
  GIYAHERO_APP_NAME: "GiyaHero Staging",
  GIYAHERO_APPLE_TEAM_ID: "ABCDE12345",
  GIYAHERO_ANDROID_SHA256: Array(32).fill("AA").join(":"),
};
it("rejects incomplete or inconsistent release identities", () => {
  for (const change of [
    { VITE_WEB_ORIGIN: "http://staging.giyahero.ph" },
    { GIYAHERO_APPLE_TEAM_ID: "" },
    { GIYAHERO_ANDROID_SHA256: "AA:BB" },
    { VITE_AUTH_CALLBACK_URL: "https://evil.test/mobile/auth/callback" },
    { GIYAHERO_APP_ID: "com.example.giyahero.staging" },
    { VITE_SUPABASE_ANON_KEY: "test-key" },
  ])
    expect(() => validateReleaseConfig({ ...env, ...change })).toThrow();
});
it("generates exact callback associations from supplied identities", () => {
  const config = validateReleaseConfig(env);
  const { android, apple } = linkAssociations(config);
  expect(android[0].target.package_name).toBe(env.GIYAHERO_APP_ID);
  expect(android[0].target.sha256_cert_fingerprints).toEqual([
    env.GIYAHERO_ANDROID_SHA256,
  ]);
  expect(apple.applinks.details[0].appID).toBe(
    "ABCDE12345.ph.giyahero.app.staging",
  );
  expect(apple.applinks.details[0].paths).toEqual(["/mobile/auth/callback"]);
});
