import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "../.."),
  mobile = resolve(root, "mobile");
if (existsSync(join(mobile, ".env.local")))
  process.loadEnvFile(join(mobile, ".env.local"));
const appId = process.env.GIYAHERO_APP_ID,
  appName = process.env.GIYAHERO_APP_NAME;
if (
  !appId ||
  !/^([a-z][a-z0-9_]*\.){2,}[a-z][a-z0-9_]*$/.test(appId) ||
  !appName
)
  throw new Error("Configure GIYAHERO_APP_ID and GIYAHERO_APP_NAME.");
const origin = new URL(process.env.VITE_WEB_ORIGIN ?? "");
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw new Error("Configure an HTTPS VITE_WEB_ORIGIN.");
const xml = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function edit(path, update) {
  const file = join(mobile, path);
  writeFileSync(file, update(readFileSync(file, "utf8")));
}
edit("android/app/build.gradle", (s) =>
  s
    .replace(/namespace = "[^"]+"/, 'namespace = "' + appId + '"')
    .replace(/applicationId "[^"]+"/, 'applicationId "' + appId + '"'),
);
function java(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) java(path);
    else if (entry.name === "MainActivity.java") {
      writeFileSync(
        path,
        readFileSync(path, "utf8").replace(
          /package [^;]+;/,
          "package " + appId + ";",
        ),
      );
    }
  }
}
java(join(mobile, "android/app/src/main/java"));
edit("android/app/src/main/res/values/strings.xml", (s) =>
  s
    .replace(
      /(<string name="(?:app_name|title_activity_main)">)[^<]+/g,
      "$1" + xml(appName),
    )
    .replace(
      /(<string name="(?:package_name|custom_url_scheme)">)[^<]+/g,
      "$1" + appId,
    ),
);
const filter =
  '<!-- GIYAHERO_APP_LINK_START -->\n<intent-filter android:autoVerify="true">\n<action android:name="android.intent.action.VIEW" />\n<category android:name="android.intent.category.DEFAULT" />\n<category android:name="android.intent.category.BROWSABLE" />\n<data android:scheme="https" android:host="' +
  xml(origin.hostname) +
  '" android:path="/mobile/auth/callback" />\n</intent-filter>\n<!-- GIYAHERO_APP_LINK_END -->';
edit("android/app/src/main/AndroidManifest.xml", (s) =>
  s
    .replace(
      /android:allowBackup="true"/,
      'android:allowBackup="false" android:usesCleartextTraffic="false"',
    )
    .replace(
      /\s*<!-- GIYAHERO_APP_LINK_START -->[\s\S]*?<!-- GIYAHERO_APP_LINK_END -->/,
      "",
    )
    .replace("</activity>", filter + "\n</activity>"),
);
const entitlements =
  '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>com.apple.developer.associated-domains</key><array><string>applinks:' +
  xml(origin.hostname) +
  "</string></array></dict></plist>\n";
writeFileSync(join(mobile, "ios/App/App/App.entitlements"), entitlements);
edit("ios/App/App.xcodeproj/project.pbxproj", (s) =>
  s
    .replace(
      /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
      "PRODUCT_BUNDLE_IDENTIFIER = " + appId + ";",
    )
    .replace(/\s*CODE_SIGN_ENTITLEMENTS = [^;]+;/g, "")
    .replace(
      /CODE_SIGN_STYLE = Automatic;/g,
      "CODE_SIGN_STYLE = Automatic;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;",
    ),
);
edit("ios/App/App/Info.plist", (s) =>
  s.replace(
    /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]+/,
    "$1" + xml(appName),
  ),
);
console.log(
  "Native identifiers and callback domain configured. Generate matching association files before device auth tests.",
);
