import { outboxDatabase, type OutboxDatabase } from "@/lib/offline";
import type { FairSnapshot, FairSnapshotProduct } from "@/lib/offline";

/**
 * El snapshot de feria (KAM-12, design.md decisión 12).
 *
 * El service worker de KAM-11 no cachea rutas de negocio, y con razón: un
 * tablero servido de caché muestra un estado que ya no existe y quien lo mira
 * no tiene forma de saberlo. Pero esa regla, aplicada a la feria, deja a quien
 * llega al puesto sin señal frente a la página de sin conexión.
 *
 * La salida no es cachear la ruta: es que la persona **capture** el catálogo a
 * propósito, al abrir la feria con red, y que la cuadrícula muestre siempre de
 * cuándo es lo que enseña. El dato es igual de viejo; la diferencia es que se
 * ve.
 */

export type { FairSnapshot, FairSnapshotProduct };

/** Una feria es una organización y una línea. Cambiar de línea es otra feria. */
export function snapshotId(organizationId: string, businessLineId: string): string {
  return `${organizationId}:${businessLineId}`;
}

export async function saveSnapshot(
  snapshot: Omit<FairSnapshot, "id">,
  db: OutboxDatabase = outboxDatabase(),
): Promise<void> {
  await db.fairSnapshots.put({
    ...snapshot,
    id: snapshotId(snapshot.organizationId, snapshot.businessLineId),
  });
}

/**
 * El snapshot de una feria, o `null` si nunca se abrió con red. `null` no es
 * un error: es la señal de que hay que decirle a la persona que abra la feria
 * una vez con señal, en vez de enseñarle una cuadrícula vacía sin explicación.
 */
export async function readSnapshot(
  organizationId: string,
  businessLineId: string,
  db: OutboxDatabase = outboxDatabase(),
): Promise<FairSnapshot | null> {
  const found = await db.fairSnapshots.get(snapshotId(organizationId, businessLineId));
  return found ?? null;
}

/** El snapshot más reciente de la organización, sin saber aún qué línea. */
export async function readLatestSnapshot(
  organizationId: string,
  db: OutboxDatabase = outboxDatabase(),
): Promise<FairSnapshot | null> {
  const found = await db.fairSnapshots.where("organizationId").equals(organizationId).toArray();

  if (found.length === 0) return null;

  return found.reduce((newest: FairSnapshot, current: FairSnapshot) =>
    current.capturedAt > newest.capturedAt ? current : newest,
  );
}

/**
 * Antigüedad del snapshot en minutos. La cuadrícula la traduce a algo legible;
 * el cálculo vive aquí para poder probarlo sin montar nada.
 */
export function snapshotAgeMinutes(
  snapshot: Pick<FairSnapshot, "capturedAt">,
  now: Date = new Date(),
): number {
  const captured = new Date(snapshot.capturedAt).getTime();
  if (!Number.isFinite(captured)) return 0;

  return Math.max(0, Math.floor((now.getTime() - captured) / 60_000));
}

/**
 * Cómo se dice la antigüedad en la cuadrícula. Nunca «hace 0 minutos»: eso se
 * lee como un error, no como «acabas de cargarlo».
 */
export function snapshotAgeLabel(
  snapshot: Pick<FairSnapshot, "capturedAt">,
  now: Date = new Date(),
): string {
  const minutes = snapshotAgeMinutes(snapshot, now);

  if (minutes < 1) return "Catálogo cargado ahora mismo";
  if (minutes < 60) return `Catálogo cargado hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Catálogo cargado hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "Catálogo cargado ayer" : `Catálogo cargado hace ${days} días`;
}
