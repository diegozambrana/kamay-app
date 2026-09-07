import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { marginOf, type CashFlow } from "@/lib/dashboard/indicators";
import { cn } from "@/lib/utils";

/** El monto se muestra con dos decimales, como en el resto del sistema. */
function money(value: number): string {
  return value.toFixed(2);
}

type IndicatorProps = {
  label: string;
  amount: number;
  /** Qué periodo cubre la cifra. "Por cobrar" no es del mes: es un saldo. */
  note: string;
  /** Dónde se explica esta cifra. Sin destino todavía, no se enlaza. */
  href?: string;
  emphasis?: boolean;
  testId: string;
};

/**
 * Una tarjeta de indicador.
 *
 * Cuando el destino existe es un enlace; cuando no —hoy, reportes es KAM-20—
 * es un bloque con su leyenda. Un enlace a una ruta inexistente sería un 404
 * disfrazado de indicador (design D9, mismo criterio que la campana).
 */
function Indicator({
  label,
  amount,
  note,
  href,
  emphasis = false,
  testId,
}: IndicatorProps) {
  const body = (
    <CardContent className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        data-testid={`${testId}-amount`}
        className={cn(
          "text-2xl font-semibold tabular-nums",
          // El margen negativo se muestra tal cual y además se ve: un mes en
          // el que se compró un horno resta, y eso es información, no un
          // error que haya que disimular.
          emphasis && amount < 0 && "text-destructive",
        )}
      >
        {money(amount)}
      </span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </CardContent>
  );

  return (
    <Card data-testid={testId} className="min-w-0">
      {href ? (
        <Link href={href} className="hover:bg-accent/40">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

/**
 * Las cuatro tarjetas del panel: Ingresos, Egresos, Margen y Por cobrar.
 *
 * Las tres primeras son **caja del mes** —lo que entró y lo que salió— y la
 * cuarta es un **saldo vivo** sin periodo. Esa diferencia no es un detalle:
 * es lo que hace que las cuatro juntas cuenten la historia completa, y por
 * eso cada tarjeta dice de qué periodo habla.
 *
 * Solo se rinden para la persona dueña. La composición del ayudante ni
 * siquiera importa este componente (design D5).
 */
export function IndicatorCards({
  flow,
  receivable,
  monthLabel,
  reportsHref,
}: {
  flow: CashFlow;
  receivable: number;
  monthLabel: string;
  /** Ausente mientras V14 no exista. */
  reportsHref?: string;
}) {
  const margin = marginOf(flow);

  return (
    <div
      data-testid="indicator-cards"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <Indicator
        label="Ingresos"
        amount={flow.collected}
        note={`Cobrado en ${monthLabel}`}
        href={reportsHref}
        testId="indicator-income"
      />
      <Indicator
        label="Egresos"
        amount={flow.paid}
        note={`Pagado en ${monthLabel}`}
        href={reportsHref}
        testId="indicator-expenses"
      />
      <Indicator
        label="Margen"
        amount={margin}
        note={`Ingresos menos egresos de ${monthLabel}`}
        href={reportsHref}
        emphasis
        testId="indicator-margin"
      />
      <Indicator
        label="Por cobrar"
        amount={receivable}
        // Sin periodo a propósito: un pedido de hace tres meses sigue
        // debiéndose hoy, y recortarlo al mes lo escondería.
        note="Saldo pendiente de todos los pedidos"
        href={reportsHref}
        testId="indicator-receivable"
      />
    </div>
  );
}
