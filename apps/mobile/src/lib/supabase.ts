// URL polyfill is required so the Supabase client can construct URLs at
// runtime on RN (React Native does not implement WHATWG URL by default).
import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";

import type { Database } from "@domirank/shared/supabase";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy apps/mobile/.env.example to .env.local and fill both EXPO_PUBLIC_* values.",
  );
}

// SecureStore is async and only exposes get/set/deleteItemAsync. Supabase's
// SupportedStorage interface matches — we just alias the names.
const secureStoreAdapter: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // Native app — no URL to detect the session in. Prevents the client from
    // trying to parse window.location on RN (which does not exist).
    detectSessionInUrl: false,
  },
});
