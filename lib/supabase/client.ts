import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para componentes de cliente que necesitan acceso directo. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
