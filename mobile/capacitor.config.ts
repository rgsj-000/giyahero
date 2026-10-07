import type { CapacitorConfig } from "@capacitor/cli";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const appId = process.env.GIYAHERO_APP_ID;
const appName = process.env.GIYAHERO_APP_NAME;
if (
  !appId ||
  !/^([a-z][a-z0-9_]*\.){2,}[a-z][a-z0-9_]*$/.test(appId) ||
  !appName
)
  throw new Error(
    "Set GIYAHERO_APP_ID and GIYAHERO_APP_NAME before native generation/sync. Use separate staging and production identifiers.",
  );
const config: CapacitorConfig = {
  appId,
  appName,
  webDir: "dist",
  android: { allowMixedContent: false },
  ios: { contentInset: "always" },
  plugins: {
    SplashScreen: { backgroundColor: "#003a80", launchShowDuration: 1200 },
  },
};
export default config;
