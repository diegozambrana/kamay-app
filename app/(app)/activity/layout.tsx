import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { defaultLandingPath } from "@/lib/auth/routes";
import { getOwnerContext } from "@/lib/auth/session-context";

/**
 * V23 · Bitácora: todo el árbol es solo del dueño (matriz de acceso §16).
 *
 * El patrón es el de `app/(app)/expenses/layout.tsx` y **no** el de
 * `app/(app)/settings/layout.tsx`, que dejó de exigir dueño en KAM-17 al bajar
 * la guardia a cada sección (design D13).
 *
 * Esta guardia es interfaz. La seguridad real es la política de lectura de
 * `activity_log`, que solo tiene `using (is_owner(organization_id))`: un
 * ayudante que llegara aquí vería una lista vacía, no los datos.
 */
export default async function ActivityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getOwnerContext();

  if (!context) {
    // A su aterrizaje habitual, no a una pantalla de "no autorizado".
    redirect(defaultLandingPath((await headers()).get("user-agent")));
  }

  return children;
}
