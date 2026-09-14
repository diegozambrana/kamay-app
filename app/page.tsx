import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRequestUser } from "@/lib/auth/request-user";
import { rootRedirectPath } from "@/lib/auth/routes";

/**
 * La raíz no tiene contenido propio (KAM-25): quien la resuelve es el proxy,
 * antes de cualquier render, y esta página no debería alcanzarse nunca. Queda
 * como red de seguridad, igual que la guardia del layout de `(app)`: sin ella,
 * un `matcher` roto convertiría `/` en un 404 cuyo "Ir al inicio" lleva otra
 * vez a `/`.
 *
 * No usa `resolvePostAuthPath()`: escribe la cookie de organización, y eso no
 * se puede hacer durante el render. La selección la hace el layout de `(app)`
 * al llegar al aterrizaje.
 */
export default async function RootPage() {
  const user = await getRequestUser();
  const userAgent = (await headers()).get("user-agent");
  redirect(rootRedirectPath(Boolean(user), userAgent));
}
