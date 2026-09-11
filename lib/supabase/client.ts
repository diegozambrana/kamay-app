import { createBrowserClient } from "@supabase/ssr";

import { ORIGIN_HEADER, originFromUserAgent } from "@/lib/activity/origin";

/**
 * Cliente Supabase para componentes de cliente que necesitan acceso directo.
 *
 * Envía `x-client-origin` como el del servidor (design D12), para que una
 * escritura que salga del navegador —el sincronizado sin conexión, sobre
 * todo— quede en la bitácora con su origen y no en blanco.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          [ORIGIN_HEADER]: originFromUserAgent(
            typeof navigator === "undefined" ? null : navigator.userAgent,
          ),
        },
      },
    },
  );
}
