import type { Page } from "@playwright/test";
export const testUser = {
  id: "10000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Test Owner" },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
export async function seedBrowserSession(page: Page) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: testUser.id,
        aud: "authenticated",
        role: "authenticated",
        exp,
      }),
    ).toString("base64url") +
    ".test-signature";
  const session = {
    access_token: access,
    refresh_token: "test-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user: testUser,
  };
  await page.context().addCookies([
    {
      name: "sb-staging-auth-token",
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}
