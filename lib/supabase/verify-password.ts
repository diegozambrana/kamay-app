import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Verifica la contraseña actual sin tocar la sesión real (KAM-24, design D2).
 *
 * `supabase.auth.updateUser({ password })` no exige la contraseña anterior
 * bajo la configuración de este proyecto (`secure_password_change = false`),
 * así que la verificación es responsabilidad de la aplicación. Se hace con un
 * cliente Supabase desechable —clave anónima, sin persistir sesión ni cookies
 * del navegador— que intenta autenticar con la contraseña recibida: si lo
 * logra, era la correcta. El cliente se descarta sin llamar `signOut()`: no
 * hay nada que cerrar, porque nunca tocó las cookies de la sesión del usuario.
 */
export async function verifyCurrentPassword(
  email: string,
  password: string,
): Promise<boolean> {
  const disposable = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await disposable.auth.signInWithPassword({ email, password });
  return !error;
}
