import { RecordHistory } from "@/components/activity/record-history";
import type { RecordHistory as RecordHistoryData } from "@/services/activity/record-history";

export type TaskHistoryProps = {
  history: RecordHistoryData;
  timezone: string;
};

/**
 * El historial de la tarea (design D7 de KAM-16).
 *
 * Un solo historial (convención nº 7): esto lee de `activity_log` a través del
 * servicio y de ninguna otra fuente. **No existe ninguna tabla de historial de
 * tareas**, y la manera de garantizarlo es no haber escrito ninguna.
 *
 * Desde KAM-22 la redacción y el bloque son los compartidos: el mismo evento
 * se lee igual aquí que en la bitácora general, y el paso a `/activity`
 * filtrada por esta tarea sustituye al aviso de «llega con la pantalla de
 * bitácora» que KAM-16 dejó declarado.
 *
 * Para el ayudante llega vacío, porque RLS reserva la bitácora al dueño: el
 * bloque se rinde con su mensaje de lista sin contenido, no con un error.
 */
export function TaskHistory({ history, timezone }: TaskHistoryProps) {
  return <RecordHistory history={history} timezone={timezone} />;
}
