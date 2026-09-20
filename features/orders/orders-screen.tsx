"use client";

import {
  CalendarDaysIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MainContainer } from "@/components/layout/main-container";
import { EmptyState } from "@/components/shared/empty-state";
import { FilteredEmptyState } from "@/components/shared/filtered-empty-state";
import { LoadMore } from "@/components/shared/load-more";
import { OutstandingSummary } from "@/features/payments/outstanding-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFilterState } from "@/hooks/use-filter-state";
import { sanitizeFrom, withFrom } from "@/lib/orders/list-href";
import { ALL_LINES, type BusinessLine, type OutstandingByLine, type Status } from "@/types";

import { BoardView, type BoardOrder } from "./board-view";
import { OrdersFromProvider } from "./orders-from";
import { CalendarView } from "./calendar-view";
import { ListView } from "./list-view";

type View = "board" | "list" | "calendar";

/**
 * Los parámetros que estrechan el resultado. `view` y `archived` no: el
 * primero cambia la forma y el segundo ensancha (design D2).
 */
const ORDER_FILTERS = ["q"] as const;

/**
 * V3 · Pantalla de pedidos. Los filtros y la vista viven en la dirección, de
 * modo que cambiar de vista los conserva sin ningún estado compartido y el
 * tablero es enlazable.
 */
export function OrdersScreen({
  orders,
  statuses,
  allStatuses,
  lines,
  activeLineId,
  receivables,
  view,
  search,
  includeArchived,
  today,
  closedLimit,
  hasMoreClosed,
  statusesByLine = {},
}: {
  orders: BoardOrder[];
  /** El juego resuelto de la línea activa: las columnas del tablero. */
  statuses: Status[];
  /** Todos los estados del flujo: la lista los necesita para nombrarlos. */
  allStatuses: Status[];
  /**
   * Con "Todas", el juego resuelto de cada línea activa: el tablero por tipo
   * decide con él a qué estado va un pedido al moverlo.
   */
  statusesByLine?: Record<string, Status[]>;
  lines: BusinessLine[];
  activeLineId: string | null;
  /** Lo pendiente de cobro por línea, tal como llega de la vista. */
  receivables: OutstandingByLine[];
  view: View;
  search: string;
  includeArchived: boolean;
  today: string;
  /** Cuántos pedidos cerrados trae la ventana (KAM-23). */
  closedLimit: number;
  /** Si hay pedidos cerrados más antiguos que los que se muestran. */
  hasMoreClosed: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { hasActiveFilters, clearFilters } = useFilterState(ORDER_FILTERS);
  const activeLineName = lines.find((line) => line.id === activeLineId)?.name;
  // La vista y los filtros actuales viajan como `?from=` a alta y detalle,
  // para que la miga «Pedidos» vuelva exactamente aquí.
  const from = sanitizeFrom(params.toString());

  // «Guardar» en el alta vuelve aquí con `?created=<número>`. El aviso se
  // guarda en el estado y el parámetro se quita de la dirección, para que
  // recargar o compartir el enlace no lo repita.
  const [created, setCreated] = useState<string | null>(() => params.get("created"));
  useEffect(() => {
    if (!params.has("created")) return;
    const next = new URLSearchParams(params.toString());
    next.delete("created");
    const query = next.toString();
    router.replace(query ? `/orders?${query}` : "/orders", { scroll: false });
  }, [params, router]);

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/orders?${next.toString()}`);
  }

  return (
    <OrdersFromProvider value={from}>
      <MainContainer
        title="Pedidos"
        description="El trabajo comprometido con clientes."
        action={
          <div className="flex flex-wrap items-center gap-2">
          {/* Por cobrar de la línea activa. Su sitio definitivo es el panel
              principal (V2, KAM-14), que leerá la misma vista. */}
          <OutstandingSummary
            label="Por cobrar"
            rows={receivables}
            activeLine={activeLineId ?? ALL_LINES}
            testId="receivables-summary"
          />

          {/* El conmutador solo cambia `view`: los demás filtros siguen en la
             dirección, así que sobreviven al cambio. */}
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => value && updateParams({ view: value })}
            variant="outline"
            aria-label="Vista"
          >
            <ToggleGroupItem value="board" aria-label="Tablero">
              <LayoutGridIcon className="size-4" aria-hidden /> Tablero
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Lista">
              <ListIcon className="size-4" aria-hidden /> Lista
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Calendario">
              <CalendarDaysIcon className="size-4" aria-hidden /> Calendario
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Ambos roles registran pedidos (matriz de acceso §16). */}
          <Button asChild data-testid="new-order">
            <Link href={withFrom("/orders/new", from)}>
              <PlusIcon className="size-4" aria-hidden /> Nuevo pedido
            </Link>
          </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field className="w-64">
            <FieldLabel htmlFor="orders-search">Buscar</FieldLabel>
            <Input
              id="orders-search"
              // La clave lo reinicia cuando «Quitar filtros» vacía la dirección:
              // un campo no controlado conservaría el texto viejo.
              key={search}
              defaultValue={search}
              placeholder="Número o cliente"
              onBlur={(event) => updateParams({ q: event.target.value })}
            />
          </Field>

          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox
              checked={includeArchived}
              onCheckedChange={(checked) =>
                updateParams({ archived: checked ? "1" : null })
              }
            />
            Ver archivados
          </label>
        </div>

        {created && (
          <Alert data-testid="order-created-notice" role="status">
            <AlertTitle>Pedido #{created} guardado</AlertTitle>
            <AlertDescription>
              <span>Ya está entre los pedidos.</span>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => setCreated(null)}
              >
                Cerrar aviso
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>No se pudo completar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {orders.length === 0 ? (
          // Sin pedidos, las tres vistas dicen lo mismo: el vacío inicial o el
          // de filtrado, según haya filtros —nunca según el conteo (design D2)—.
          hasActiveFilters ? (
            <FilteredEmptyState
              description="Ningún pedido coincide con la búsqueda."
              onClearFilters={clearFilters}
            />
          ) : (
            <EmptyState
              title={
                activeLineName
                  ? `Aún no hay pedidos en ${activeLineName}`
                  : "Aún no hay pedidos"
              }
              action={
                <Button asChild>
                  <Link href={withFrom("/orders/new", from)}>Crear pedido</Link>
                </Button>
              }
            />
          )
        ) : view === "board" ? (
          // Con "Todas" no hay un juego único de columnas —cada línea tiene
          // su flujo—, así que las columnas pasan a ser los tipos de estado,
          // que sí son comunes (design D5 de
          // `navigation-breadcrumbs-and-all-lines-board`).
          <BoardView
            orders={orders}
            statuses={statuses}
            today={today}
            onError={setError}
            groupBy={activeLineId ? "status" : "kind"}
            allStatuses={allStatuses}
            statusesByLine={statusesByLine}
          />
        ) : view === "list" ? (
          <ListView
            orders={orders}
            // Con una línea activa, sus estados exactos (igual que el
            // tablero); con "Todas" no hay un solo juego, así que se agrupa
            // por todos los estados del flujo (design.md D1).
            statuses={activeLineId ? statuses : allStatuses}
            today={today}
          />
        ) : (
          <CalendarView orders={orders} today={today} />
        )}

        {hasMoreClosed && (
          <LoadMore
            param="closed"
            limit={closedLimit}
            shownLabel={`todos los pedidos abiertos y los ${closedLimit} cerrados más recientes`}
          />
        )}
        </div>
      </MainContainer>
    </OrdersFromProvider>
  );
}
