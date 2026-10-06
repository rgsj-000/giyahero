import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/infrastructure/config/env";

export function createAdminSupabaseClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
