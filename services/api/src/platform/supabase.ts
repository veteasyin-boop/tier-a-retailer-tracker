import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";

export type SupabaseClients = {
  auth: SupabaseClient;
  admin: SupabaseClient;
};

export function createSupabaseClients(config: AppConfig): SupabaseClients {
  const common = {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  } as const;

  return {
    // Used only to validate incoming user access tokens with Auth.
    auth: createClient(config.supabaseUrl, config.supabaseAnonKey, common),
    // Server-only client. Never serialize or expose this client to the browser.
    admin: createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      ...common,
      global: { headers: { "X-Client-Info": "growta-api" } }
    })
  };
}
