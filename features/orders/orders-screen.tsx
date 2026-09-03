"use client";

import { CalendarDaysIcon, LayoutGridIcon, ListIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { selectBusinessLine } from "@/actions/business-line-context";
import { MainContainer } from "@/components/layout/main-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { cn } from "@/lib/utils";
import type { BusinessLine, Status } from "@/types";

import { BoardView, type BoardOrder } from "./board-view";
import { CalendarView } from "./calendar-view";
import { ListView } from "./list-view";

type View = "board" | "list" | "calendar";

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
  view,
  search,
  includeArchived,
  today,
}: {
  orders: BoardOrder[];
  /** El juego resuelto de la línea activa: las columnas del tablero. */
  statuses: Status[];
  /** Todos los estados del flujo: la lista los necesita para nombrarlos. */
  allStatuses: Status[];
  lines: BusinessLine[];
  activeLineId: string | null;
  view: View;
  search: string;
  includeArchived: boolean;
  today: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/orders?${next.toString()}`);
  }

  return (
    <MainContainer
      title="Pedidos"
      description="El trabajo comprometido con clientes."
      action={
        /* El conmutador solo cambia `view`: los demás filtros siguen en la
           dirección, así que sobreviven al cambio. */
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
      }
    >
      <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field className="w-64">
          <FieldLabel htmlFor="orders-search">Buscar</FieldLabel>
          <Input
            id="orders-search"
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

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>No se pudo completar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {view === "board" ? (
        activeLineId ? (
          <BoardView
            orders={orders}
            statuses={statuses}
            today={today}
            onError={setError}
          />
        ) : (
          <PickALine lines={lines} />
        )
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
      </div>
    </MainContainer>
  );
}

/**
 * Con "Todas" activa no hay un juego único de columnas: cada línea tiene su
 * flujo y no se corresponden. En vez de inventar un tablero que mezcle
 * flujos, o de esconder en silencio los pedidos que no encajen, se pide
 * elegir una línea — y lista y calendario siguen disponibles (design.md D1).
 */
function PickALine({ lines }: { lines: BusinessLine[] }) {
  return (
    <div
      data-testid="board-needs-line"
      className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-12 text-center"
    >
      <div>
        <p className="font-medium">El tablero necesita una línea</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada línea tiene su propio flujo de trabajo, así que no hay columnas
          comunes a todas. Elige una — o mira los pedidos de todas en lista o
          calendario.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {lines.map((line) => (
          <Button
            key={line.id}
            variant="outline"
            onClick={() => selectBusinessLine(line.id)}
          >
            <span
              className={cn("size-2 rounded-full", lineColorClasses(line.color).dot)}
            />
            {line.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
