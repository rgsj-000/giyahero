import { expect, it } from "vitest";
import {
  parseAuthLink,
  createAuthLinkHandler,
  safeReturnPath,
} from "../../mobile/src/auth/auth-links";
const callback = "https://stage.giyahero.test/mobile/auth/callback";
it("accepts only the configured HTTPS callback origin and exact path", () => {
  expect(parseAuthLink(callback + "?code=valid", callback)).toEqual({
    code: "valid",
  });
  for (const url of [
    "https://evil.test/mobile/auth/callback?code=x",
    callback + "/extra?code=x",
    "http://stage.giyahero.test/mobile/auth/callback?code=x",
    "https://user@stage.giyahero.test/mobile/auth/callback?code=x",
  ])
    expect(parseAuthLink(url, callback)).toBeNull();
  expect(() => parseAuthLink(callback, callback)).toThrow("code");
  expect(() =>
    parseAuthLink(callback + "?error=access_denied", callback),
  ).toThrow("Sign-in");
});
it("deduplicates concurrent callbacks and supports a cold-start callback", async () => {
  let calls = 0,
    returns = 0;
  const handle = createAuthLinkHandler(
    callback,
    async () => {
      calls++;
      await Promise.resolve();
    },
    async () => {
      returns++;
    },
  );
  expect(
    await Promise.all([
      handle(callback + "?code=one"),
      handle(callback + "?code=one"),
    ]),
  ).toEqual(["handled", "handled"]);
  expect(await handle(callback + "?code=one")).toBe("handled");
  expect(calls).toBe(1);
  expect(returns).toBe(1);
  expect(await handle("https://evil.test/?code=x")).toBe("ignored");
});
it("keeps safe marketplace return paths and rejects external redirects", () => {
  expect(safeReturnPath("/#trips")).toBe("/#trips");
  expect(
    safeReturnPath("/#book/30000000-0000-4000-8000-000000000001"),
  ).toContain("book/");
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/#auth?next=//evil.test",
    null,
  ])
    expect(safeReturnPath(path)).toBe("/#browse");
});
