import { Skeleton } from "@/components/ui/skeleton";

import { LoadingRegion } from "./loading-region";

export { LoadingRegion };

/**
 * Esqueletos con la forma del contenido real (mapa de navegación §12): el
 * inventario de vistas del cambio KAM-23 encontró cinco formas —lista,
 * tablero, detalle, formulario y tarjetas— y hay uno por forma, no uno por
 * pantalla. Ninguno usa girador: la carga se ve como la pantalla que viene.
 */

/** Filtros arriba y filas debajo: egresos, contactos, catálogo, bitácora… */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LoadingRegion className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex flex-col divide-y rounded-md border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 p-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Columnas con tarjetas: los tableros de pedidos y de tareas. */
export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <LoadingRegion className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: columns }, (_, column) => (
          <div
            key={column}
            className="flex w-72 shrink-0 flex-col gap-3 rounded-lg bg-muted/40 p-3"
          >
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 - (column % 2) }, (_, card) => (
              <Skeleton key={card} className="h-20 w-full" />
            ))}
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Cabecera con campos y bloques debajo: pedido, egreso, ítem, tarea. */
export function DetailSkeleton() {
  return (
    <LoadingRegion className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-32" />
          </div>
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </LoadingRegion>
  );
}

/** Etiquetas y campos: las altas y la edición de pedidos. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <LoadingRegion className="flex max-w-2xl flex-col gap-5">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-32" />
    </LoadingRegion>
  );
}

/** Rejilla de tarjetas: el panel, los informes y la captura rápida. */
export function CardsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <LoadingRegion className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </LoadingRegion>
  );
}
