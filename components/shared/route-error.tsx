"use client";

import { MainContainer } from "@/components/layout/main-container";

import { SectionError, type SectionErrorProps } from "./section-error";

export type RouteErrorProps = SectionErrorProps;

/**
 * Lo que rinde el `error.tsx` de cada segmento con datos (design D1).
 *
 * Conserva el encabezado de la sección —quien estaba en Pedidos sigue viendo
 * «Pedidos»— y sustituye solo el contenido por el estado de error.
 */
export function RouteError({
  title,
  error,
  retry,
}: RouteErrorProps & { title: string }) {
  return (
    <MainContainer title={title}>
      <SectionError boundary={title} error={error} retry={retry} />
    </MainContainer>
  );
}
