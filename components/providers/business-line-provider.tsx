"use client";

import { useHydrateStore } from "@/components/providers/use-hydrate-store";
import { useBusinessLineStore } from "@/stores/business-line-store";
import type { ActiveLine, BusinessLine } from "@/types";

/** Hidrata `BusinessLineStore` con el contexto de línea resuelto en el servidor. */
export function BusinessLineProvider({
  lines,
  activeLine,
  children,
}: {
  lines: BusinessLine[];
  activeLine: ActiveLine;
  children: React.ReactNode;
}) {
  // Ninguna pantalla debe renderizarse con un contexto de línea distinto del
  // que el servidor ya resolvió (ver `useHydrateStore`).
  useHydrateStore(
    () => useBusinessLineStore.setState({ lines, activeLine }),
    [lines, activeLine],
  );

  return children;
}
