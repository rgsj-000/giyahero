import { expect, it } from "vitest";
import { createSecureStorage } from "../../mobile/src/auth/secure-storage";
it("returns null only for absent keys and removes persisted sessions", async () => {
  const values = new Map<string, string>();
  let sync = true;
  const storage = await createSecureStorage({
    setSynchronize: async (v) => {
      sync = v;
    },
    setKeyPrefix: async () => {},
    get: async (k) => values.get(k) ?? null,
    set: async (k, v) => {
      values.set(k, v);
    },
    remove: async (k) => values.delete(k),
  });
  expect(sync).toBe(false);
  expect(await storage.getItem("session")).toBeNull();
  await storage.setItem("session", "private");
  expect(await storage.getItem("session")).toBe("private");
  await storage.removeItem("session");
  expect(await storage.getItem("session")).toBeNull();
});
it("fails closed on operating-system and corrupt-data errors", async () => {
  const storage = await createSecureStorage({
    setSynchronize: async () => {},
    setKeyPrefix: async () => {},
    get: async () => {
      throw new Error("Keychain unavailable");
    },
    set: async () => {
      throw new Error("Keystore unavailable");
    },
    remove: async () => {
      throw new Error("Removal failed");
    },
  });
  await expect(storage.getItem("session")).rejects.toThrow("Keychain");
  await expect(storage.setItem("session", "x")).rejects.toThrow("Keystore");
  await expect(storage.removeItem("session")).rejects.toThrow("Removal");
});
