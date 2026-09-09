import {
  INVENTORY_ADJUSTMENT,
  INVENTORY_CONSUMPTION,
} from "@/features/sync/operations";
import type { ConsumptionValues, CountValues } from "@/lib/inventory/schema";
import {
  capture,
  drainOutbox,
  enqueue,
  outboxDatabase,
  type CaptureResult,
} from "@/lib/offline";

/**
 * Encolar un movimiento de inventario (design D7).
 *
 * **Un solo camino, con red y sin ella**, igual que la venta de feria: no se
 * consulta `navigator.onLine` para elegir vía. Aquí sí se conserva el plazo
 * por omisión de `capture()` —2 500 ms—, a diferencia de la feria: un consumo
 * se registra cada varias horas, no cada quince segundos, y puede pagar esa
 * espera a cambio de que quien lo registró vea el saldo ya actualizado.
 *
 * El `recordId` es el `uuid` del propio movimiento, generado en el dispositivo
 * (convención nº 9): reenviarlo no puede crear un segundo, porque la clave
 * primaria lo impide y la acción da por bueno el `23505`.
 */
export type CaptureMovementDeps = {
  organizationId: string;
  userId: string;
  isOnline: () => boolean;
};

function outboxDeps(deps: CaptureMovementDeps) {
  return {
    enqueue: (input: Parameters<typeof enqueue>[0]) => enqueue(input, outboxDatabase()),
    drain: () =>
      drainOutbox({
        session: { organizationId: deps.organizationId, userId: deps.userId },
      }),
    isOnline: deps.isOnline,
  };
}

export async function captureConsumption(
  values: ConsumptionValues,
  deps: CaptureMovementDeps,
): Promise<CaptureResult> {
  return capture(
    {
      recordId: values.id,
      operation: INVENTORY_CONSUMPTION,
      payload: values,
      organizationId: deps.organizationId,
      userId: deps.userId,
    },
    outboxDeps(deps),
  );
}

export async function captureAdjustment(
  values: CountValues,
  deps: CaptureMovementDeps,
): Promise<CaptureResult> {
  return capture(
    {
      recordId: values.id,
      operation: INVENTORY_ADJUSTMENT,
      payload: values,
      organizationId: deps.organizationId,
      userId: deps.userId,
    },
    outboxDeps(deps),
  );
}
