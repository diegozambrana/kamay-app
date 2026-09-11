import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { ORIGIN_HEADER, originFromUserAgent } from "@/lib/activity/origin";

/**
 * Cliente Supabase ligado a `cookies()` de Next.js.
 * Para Server Components, Server Actions y route handlers.
 *
 * Envía `x-client-origin` en cada petición: es lo que el trigger `log_activity()`
 * guarda en `activity_log.origin` desde KAM-03, y hasta KAM-22 nadie lo
 * enviaba (design D12). Se deduce del agente de usuario de la petición, con el
 * mismo criterio que `defaultLandingPath()`.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const userAgent = (await headers()).get("user-agent");

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { [ORIGIN_HEADER]: originFromUserAgent(userAgent) },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: las cookies ya fueron
            // refrescadas por el proxy, se puede ignorar.
          }
        },
      },
    },
  );
}
