import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getOwnerContext } from "@/lib/auth/session-context";
import { defaultLandingPath } from "@/lib/auth/routes";

/**
 * V7–V9 · Egresos: todo el árbol es solo del dueño (matriz de acceso §16 y
 * criterio 5 del backlog). Esta guardia es interfaz; la seguridad real es la
 * RLS de `expenses` y `expense_items`, que no tiene ninguna política para el
 * ayudante aunque llegara hasta aquí (design D7).
 */
export default async function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getOwnerContext();

  if (!context) {
    // El ayudante que entra por dirección directa termina en su aterrizaje
    // habitual, no en una pantalla de "no autorizado".
    redirect(defaultLandingPath((await headers()).get("user-agent")));
  }

  return children;
}
