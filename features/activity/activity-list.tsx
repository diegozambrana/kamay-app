import Link from "next/link";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

import { ActivityRow, type ActivityRowItem } from "./activity-row";

/** Un día con sus eventos, ya agrupados y contados en el servidor. */
export type ActivityDay = {
  /** «Hoy», «Ayer», o el día de la semana. */
  label: string;
  /** «miércoles 19 de agosto». */
  date: string;
  items: ActivityRowItem[];
};

export type ActivityListProps = {
  days: ActivityDay[];
  /** La dirección de la página siguiente, o `null` si esta fue la última. */
  nextHref: string | null;
  /** ¿Hay algún filtro puesto? Distingue los dos estados vacíos. */
  filtered: boolean;
  /** A dónde ir para quitar los filtros. */
  clearHref: string;
};

/**
 * La lista cronológica invertida de V23, agrupada por día.
 *
 * El agrupado y el conteo vienen hechos: este componente no calcula fechas,
 * porque hacerlo en el cliente las calcularía en la zona horaria del navegador
 * y no en la de la organización, y el día de un evento cambiaría según quién
 * mire.
 */
export function ActivityList({
  days,
  nextHref,
  filtered,
  clearHref,
}: ActivityListProps) {
  if (days.length === 0) {
    return filtered ? <NoMatches clearHref={clearHref} /> : <NoEvents />;
  }

  return (
    <div className="flex flex-col gap-6" data-testid="activity-list">
      {days.map((day) => (
        <section key={`${day.label}-${day.date}`} data-testid="activity-day">
          <header className="flex items-baseline justify-between border-b pb-1">
            <h2 className="text-sm font-medium">
              {day.label}{" "}
              <span className="text-muted-foreground font-normal">
                {day.date}
              </span>
            </h2>
            <span
              className="text-muted-foreground text-xs"
              data-testid="activity-day-count"
            >
              {day.items.length === 1
                ? "1 evento"
                : `${day.items.length} eventos`}
            </span>
          </header>

          <ul>
            {day.items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ))}

      {/* «Cargar más» es navegación y no estado de cliente: así el cursor
          viaja en la dirección y recargar no devuelve a la primera página. */}
      {nextHref && (
        <div className="flex justify-center">
          <Button asChild variant="outline" data-testid="activity-more">
            <Link href={nextHref}>Cargar más</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * «Todavía no hay movimientos» y «ninguno coincide» son estados distintos y se
 * dicen distinto: el segundo tiene salida, el primero no la necesita.
 */
function NoEvents() {
  return (
    <Empty data-testid="activity-empty">
      <EmptyHeader>
        <EmptyTitle>Todavía no hay movimientos</EmptyTitle>
        <EmptyDescription>
          En cuanto alguien registre o cambie algo, aparecerá aquí.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function NoMatches({ clearHref }: { clearHref: string }) {
  return (
    <Empty data-testid="activity-no-matches">
      <EmptyHeader>
        <EmptyTitle>Ningún evento coincide con estos filtros</EmptyTitle>
        <EmptyDescription>
          Prueba con otro rango de fechas, otra línea u otro tipo de acción.
        </EmptyDescription>
      </EmptyHeader>
      <Button asChild variant="outline" className="mt-4">
        <Link href={clearHref}>Quitar los filtros</Link>
      </Button>
    </Empty>
  );
}
