import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

it("keeps service-role access server-only", () => {
  const adminSource = readFileSync(
    "src/infrastructure/supabase/admin.ts",
    "utf8",
  );
  const browserSource = readFileSync(
    "src/infrastructure/supabase/browser.ts",
    "utf8",
  );

  expect(adminSource).toContain("import 'server-only'");
  expect(adminSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
  expect(browserSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  expect(browserSource).not.toContain("@/infrastructure/config/env");
});
