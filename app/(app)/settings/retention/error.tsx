"use client";

import { SectionError, type SectionErrorProps } from "@/components/shared/section-error";

/** Dentro del layout de Configuración, que ya pinta el encabezado y las pestañas. */
export default function SettingsRetentionError(props: SectionErrorProps) {
  return <SectionError boundary="Configuración · Retención" {...props} />;
}
