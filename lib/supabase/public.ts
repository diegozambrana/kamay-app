import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * KAM-28 · Cliente sin sesión para el flujo público de `/r/<token>`.
 *
 * A diferencia de `lib/supabase/server.ts` y `lib/supabase/client.ts`, nunca
 * lee ni escribe la cookie de sesión que gestiona `@supabase/ssr`: se
 * comporta exactamente igual lo abra quien lo abra, tenga o no una sesión de
 * staff abierta en el mismo navegador (design D7). Es lo que hace que
 * `resolve_order_request`/`submit_order_request` y la subida a la cuarentena
 * corran siempre como `anon` — y por tanto que `log_activity()` atribuya el
 * envío a «Formulario público» y nunca a la persona que probó su propio
 * enlace (design D3).
 *
 * Isomorfo a propósito: sirve tanto al componente de servidor que resuelve el
 * token como al formulario de cliente que sube las imágenes. Ambos solo
 * necesitan la llave anónima, que ya es pública en el bundle del navegador.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    },
  );
}
