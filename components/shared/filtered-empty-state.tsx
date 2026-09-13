import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type FilteredEmptyStateProps = {
  /** Qué se buscaba, si la vista quiere decirlo: «Ningún insumo coincide…». */
  description?: string;
  className?: string;
} & (
  | { onClearFilters: () => void; clearHref?: never }
  /**
   * La dirección sin filtros, para las vistas que se rinden en el servidor y
   * no pueden pasar una función: la bitácora (V23) arma la suya allí.
   */
  | { clearHref: string; onClearFilters?: never }
);

/**
 * Sin resultados tras filtrar: hay registros, pero los filtros no dejan
 * ninguno (mapa de navegación §12, spec `view-states`).
 *
 * Tiene su propio texto y su propia acción para que nadie lo confunda con el
 * vacío inicial: la causa aquí es el filtro, y la salida es quitarlo. Qué
 * estado toca lo decide `useFilterState().hasActiveFilters`, nunca el conteo
 * de filas (design D2).
 */
export function FilteredEmptyState({
  description = "Ningún registro coincide con los filtros aplicados.",
  onClearFilters,
  clearHref,
  className,
}: FilteredEmptyStateProps) {
  return (
    <Empty
      data-testid="filtered-empty-state"
      className={cn("border border-dashed", className)}
    >
      <EmptyHeader>
        <EmptyTitle>Sin resultados</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {clearHref !== undefined ? (
          <Button asChild variant="outline">
            <Link href={clearHref}>Quitar filtros</Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onClearFilters}>
            Quitar filtros
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );
}
