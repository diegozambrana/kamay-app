import { DIRECT_SALE_CREATE } from "@/features/sync/operations";
import type { DirectSaleInput } from "@/lib/fair/sale-schema";
import {
  capture,
  drainOutbox,
  enqueue,
  outboxDatabase,
  type CaptureResult,
} from "@/lib/offline";

/**
 * Encolar una venta de feria (KAM-12, design.md decisión 6).
 *
 * **Un solo camino, con red y sin ella.** No se consulta `navigator.onLine`
 * para decidir la vía: el caso real de una feria no es la red caída del
 * laboratorio, es la red *a medias*. Ahí una petición directa cuelga treinta
 * segundos, quien vende reintenta y aparece el duplicado. Con un solo camino,
 * la red a medias es indistinguible de la red caída y el reintento lo gobierna
 * la cola.
 *
 * La diferencia con el resto de la aplicación es el plazo: `capture()` espera
 * por omisión 2 500 ms al vaciado para que un pedido salga dentro del mismo
 * gesto. **Aquí el plazo es cero.** Un pedido se registra cada varias horas y
 * puede pagar esa espera a cambio de saber que salió; una venta de feria
 * ocurre cada quince segundos y no puede pagar ninguna. El criterio 3 —vuelta
 * a la cuadrícula en menos de un segundo— no admite otra lectura.
 */
export const FAIR_FLUSH_DEADLINE_MS = 0;

export type CaptureSaleDeps = {
  isOnline: () => boolean;
};

export async function captureSale(
  sale: DirectSaleInput,
  userId: string,
  deps: CaptureSaleDeps,
): Promise<CaptureResult> {
  return capture(
    {
      // El `uuid` de la venta es el `recordId` del sobre: reenviarlo no puede
      // crear una venta distinta, y `create_direct_sale` es idempotente por él.
      recordId: sale.id,
      operation: DIRECT_SALE_CREATE,
      payload: sale,
      organizationId: sale.organizationId,
      userId,
      // Una venta no depende de nada: su cobro viaja dentro del mismo sobre.
    },
    {
      enqueue: (input) => enqueue(input, outboxDatabase()),
      drain: () =>
        drainOutbox({
          session: { organizationId: sale.organizationId, userId },
        }),
      isOnline: deps.isOnline,
      deadlineMs: FAIR_FLUSH_DEADLINE_MS,
    },
  );
}
