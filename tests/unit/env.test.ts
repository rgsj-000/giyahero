import { describe, expect, it } from "vitest";
import { parseEnv } from "@/infrastructure/config/env";

describe("environment configuration", () => {
  it("rejects missing required public Supabase values", () => {
    expect(() => parseEnv({ NODE_ENV: "test" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("rejects exposing the service role key through NEXT_PUBLIC variables", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        DATABASE_URL: "postgres://example",
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "do-not-expose",
      }),
    ).toThrow(/must never be public/i);
  });
});
