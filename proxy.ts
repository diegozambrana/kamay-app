import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// En Next.js 16 el middleware se llama proxy. Solo refresca la sesión y
// bloquea `(app)` sin sesión; la autorización fina vive en RLS.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Todo salvo estáticos e imágenes: el refresco de sesión debe correr
  // también en /auth y en la raíz para mantener la cookie viva.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
