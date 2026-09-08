import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PendingCounts = {
  overdue: number;
  today: number;
  upcoming: number;
};

/**
 * La tarjeta de pendientes del panel (V2), que hasta KAM-17 fue un marcador.
 *
 * Los conteos salen de la **misma función** que agrupa *Mis pendientes*
 * (`pendingCounts`, en `lib/tasks/groups.ts`): calcularlos aquí por otra vía
 * sería la forma segura de que un día dejaran de coincidir con lo que V20
 * enseña, y de las dos cifras la equivocada sería siempre esta.
 *
 * Ignora el selector de línea, igual que V20, porque cuenta lo mismo que ella.
 */
export function PendingTasksCard({ counts }: { counts: PendingCounts }) {
  const total = counts.overdue + counts.today + counts.upcoming;

  return (
    <Card data-testid="pending-tasks-card">
      <CardHeader>
        <CardTitle>
          {/* La tarjeta entera lleva a V20: el panel es punto de partida, no
              destino. */}
          <Link href="/my-tasks" className="hover:underline">
            Pendientes
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          // Ceros reales, no un marcador: aquí sí se sabe que no hay nada, y
          // decirlo es información. Es la diferencia con la tarjeta de
          // insumos, donde un cero significaría "no falta nada" sin saberlo.
          <p className="text-sm text-muted-foreground">
            No tienes tareas pendientes.
          </p>
        ) : (
          <dl className="flex gap-6">
            <Count
              label="Vencidas"
              value={counts.overdue}
              testId="pending-overdue"
              // Lo vencido en rojo: es lo único de la tarjeta que pide algo hoy.
              className={counts.overdue > 0 ? "text-destructive" : undefined}
            />
            <Count label="Hoy" value={counts.today} testId="pending-today" />
            <Count
              label="Próximos 7 días"
              value={counts.upcoming}
              testId="pending-upcoming"
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Count({
  label,
  value,
  testId,
  className,
}: {
  label: string;
  value: number;
  testId: string;
  className?: string;
}) {
  return (
    <div>
      <dd
        data-testid={testId}
        className={cn("text-2xl font-semibold tabular-nums", className)}
      >
        {value}
      </dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}
