import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  listPublishedPackages,
  getPackageDetail,
} from "@/features/catalog/catalog-service";
const client = (body: unknown, status = 200) =>
  createClient("https://staging.example.test", "test-key", {
    global: {
      fetch: async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
it("returns an empty live catalog without sample fallback", async () => {
  expect(
    await listPublishedPackages(client({ items: [], nextCursor: null }), {}),
  ).toEqual({ items: [], nextCursor: null });
});
it("surfaces a backend failure instead of fabricating inventory", async () => {
  await expect(
    listPublishedPackages(client({ message: "database unavailable" }, 503), {}),
  ).rejects.toThrow("database unavailable");
});
it("returns null for an unavailable package", async () => {
  expect(
    await getPackageDetail(
      client(null),
      "30000000-0000-4000-8000-000000000001",
    ),
  ).toBeNull();
});
it("rejects unsafe search inputs", async () => {
  await expect(
    listPublishedPackages(client({ items: [], nextCursor: null }), {
      travelers: -1,
    }),
  ).rejects.toThrow();
});
