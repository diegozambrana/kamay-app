"use client";

import { useEffect, useRef } from "react";

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
  // Hidratación síncrona una sola vez, antes del primer render de los hijos:
  // ninguna pantalla debe renderizarse con un contexto de línea distinto del
  // que el servidor ya resolvió.
  const hydrated = useRef<true | null>(null);
  if (hydrated.current == null) {
    hydrated.current = true;
    useBusinessLineStore.setState({ lines, activeLine });
  }

  useEffect(() => {
    useBusinessLineStore.setState({ lines, activeLine });
  }, [lines, activeLine]);

  return children;
}
