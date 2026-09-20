"use client";

import { SectionError, type SectionErrorProps } from "@/components/shared/section-error";

/**
 * Sin `MainContainer`: esta ruta no tiene cascarón, igual que `(fair)`
 * (`components/shared/section-error.tsx`).
 */
export default function PublicOrderRequestError(props: SectionErrorProps) {
  return <SectionError boundary="Solicitud de pedido" {...props} />;
}
