"use client";

import { SectionError, type SectionErrorProps } from "@/components/shared/section-error";

/** Dentro del layout de Configuración, que ya pinta el encabezado y las pestañas. */
export default function SettingsUnitsError(props: SectionErrorProps) {
  return <SectionError boundary="Configuración · Unidades" {...props} />;
}
