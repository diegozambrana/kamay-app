import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isProtectedPath, LOGIN_PATH, rootRedirectPath } from "@/lib/auth/routes";

/**
 * Refresco de sesión para el proxy (`proxy.ts` en la raíz): renueva la cookie
 * en cada petición, redirige a login las rutas de `(app)` sin sesión
 * —preservando el destino original en `?next=`— y resuelve la raíz `/`, que
 * no tiene contenido propio: a login sin sesión, al aterrizaje por
 * dispositivo con ella (KAM-25).
 *
 * La autorización fina (rol, organización) no vive aquí: vive en RLS
 * y se verifica además en la capa de acciones.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida el token contra el servidor de Auth y dispara el refresco.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** Redirección que conserva las cookies que el refresco acaba de escribir. */
  const redirectKeepingCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  };

  const { pathname, search } = request.nextUrl;

  if (pathname === "/") {
    // Sin `?next=` ni consulta: la raíz no es un destino (design D4). La
    // selección de organización la hace el layout de `(app)` al llegar (D3).
    const url = request.nextUrl.clone();
    url.pathname = rootRedirectPath(
      Boolean(user),
      request.headers.get("user-agent"),
    );
    url.search = "";
    return redirectKeepingCookies(url);
  }

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingCookies(url);
  }

  return supabaseResponse;
}
