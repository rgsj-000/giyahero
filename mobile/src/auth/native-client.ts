import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import {
  createSecureStorage,
  createBrowserPreviewStorage,
  type SessionStorage,
} from "./secure-storage";
export async function createNativeSupabaseClient() {
  let storage: SessionStorage;
  if (Capacitor.isNativePlatform())
    storage = await createSecureStorage(SecureStorage);
  else if (import.meta.env.VITE_BROWSER_PREVIEW === "true")
    storage = createBrowserPreviewStorage();
  else
    throw new Error(
      "This mobile bundle must run in the installed app. Set VITE_BROWSER_PREVIEW=true only for local browser testing.",
    );
  const client = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        storage,
        storageKey: "giyahero-native-auth",
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );
  // Surface secure-storage restoration errors before rendering authenticated screens.
  const { error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  return { client, storage };
}
