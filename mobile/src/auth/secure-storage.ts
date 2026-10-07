export type SessionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
type Plugin = {
  setSynchronize: (sync: boolean) => Promise<void>;
  setKeyPrefix: (prefix: string) => Promise<void>;
  get: (key: string, convertDate: boolean, sync: boolean) => Promise<unknown>;
  set: (
    key: string,
    value: string,
    convertDate: boolean,
    sync: boolean,
  ) => Promise<void>;
  remove: (key: string, sync: boolean) => Promise<boolean>;
};
export async function createSecureStorage(
  plugin: Plugin,
): Promise<SessionStorage> {
  await plugin.setSynchronize(false);
  await plugin.setKeyPrefix("giyahero-auth:");
  return {
    async getItem(key) {
      const data = await plugin.get(key, false, false);
      if (data === null) return null;
      if (typeof data !== "string")
        throw new Error("Secure session storage is corrupted.");
      return data;
    },
    async setItem(key, value) {
      await plugin.set(key, value, false, false);
    },
    async removeItem(key) {
      await plugin.remove(key, false);
    },
  };
}
export function createBrowserPreviewStorage(): SessionStorage {
  return {
    async getItem(key) {
      return localStorage.getItem(key);
    },
    async setItem(key, value) {
      localStorage.setItem(key, value);
    },
    async removeItem(key) {
      localStorage.removeItem(key);
    },
  };
}
