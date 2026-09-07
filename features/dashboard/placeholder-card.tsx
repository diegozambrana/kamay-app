import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Una pieza del panel cuyo contenido llega en una tarea posterior.
 *
 * Ocupa su ranura definitiva con su rótulo definitivo, y dice con todas las
 * letras que todavía no está disponible. Tres reglas, y las tres importan:
 *
 * 1. **Ninguna cifra.** Un cero de mentira en "Insumos bajo mínimo" se lee
 *    como "no falta nada", que es justo lo contrario de lo que se sabe.
 * 2. **Ningún control.** Nada que se pueda pulsar y no lleve a ninguna parte.
 * 3. **Su sitio definitivo.** Reservarlo ahora evita recolocar la retícula
 *    —y volver a verificarla— cuando llegue el contenido.
 *
 * Es el mismo criterio con el que KAM-13 dejó inertes los destinos Consumo y
 * Tarea de la retícula de registro rápido.
 */
export function PlaceholderCard({
  title,
  note,
  testId,
}: {
  title: string;
  /** Qué llegará aquí y con qué tarea. */
  note: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId} data-placeholder="true">
      <CardHeader>
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Los dos marcadores del panel, declarados una sola vez para que las dos
 * composiciones muestren exactamente los mismos y con el mismo texto.
 */
export const PENDING_TASKS_PLACEHOLDER = {
  title: "Pendientes",
  note: "Las tareas vencidas, las de hoy y las de los próximos siete días aparecerán aquí cuando exista el módulo de tareas.",
  testId: "placeholder-tasks",
} as const;

export const LOW_STOCK_PLACEHOLDER = {
  title: "Insumos bajo mínimo",
  note: "Los insumos por debajo de su mínimo aparecerán aquí cuando el inventario registre entradas y salidas.",
  testId: "placeholder-stock",
} as const;
