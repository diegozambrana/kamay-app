import { redirect } from "next/navigation";

import { ExportSection } from "@/features/settings/export-section";
import { getSessionContext } from "@/lib/auth/session-context";

export const metadata = { title: "Exportar · Configuración · Kamay" };

/**
 * V15 · Exportar (KAM-23, spec `data-export`).
 *
 * Para los dos roles: la exportación sale con lo que cada quien puede leer, y
 * el texto lo dice para que el ayudante no espere encontrar los egresos.
 */
export default async function ExportSettingsPage() {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const isOwner = context.membership.role === "owner";

  return (
    <section>
      <h2 className="text-lg font-medium">Exportar</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Todos los datos de {context.membership.organization.name} en un solo archivo, con una
        hoja de cálculo por tabla. Sirve de respaldo, para la contabilidad o para analizarlos
        fuera de Kamay.
      </p>
      <ExportSection isOwner={isOwner} />
    </section>
  );
}
