import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateReleaseConfig,
  linkAssociations,
  loadMobileEnv,
} from "./check-release-config.mjs";
loadMobileEnv();
const { android, apple } = linkAssociations(validateReleaseConfig(process.env));
const directory = resolve(import.meta.dirname, "../../public/.well-known");
await mkdir(directory, { recursive: true });
await writeFile(
  resolve(directory, "assetlinks.json"),
  JSON.stringify(android, null, 2) + "\n",
);
await writeFile(
  resolve(directory, "apple-app-site-association"),
  JSON.stringify(apple, null, 2) + "\n",
);
console.log(
  "Wrote deployment association files from supplied signing identities. Deploy them to the configured HTTPS domain before device auth tests.",
);
