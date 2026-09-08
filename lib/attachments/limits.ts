import { MAX_FILE_SIZE } from "@/lib/catalog/photos";

export { MAX_FILE_SIZE };

/**
 * Máximo de adjuntos vigentes de una tarea (design D5).
 *
 * Es una constante del código, no una preferencia de la organización: el
 * backlog dice «el límite configurado» sin decir dónde se configura, V15 no
 * tiene ninguna sección de límites, y el proyecto ya resolvió el mismo caso
 * así en pedidos (`MAX_ATTACHMENTS_PER_RECORD`).
 *
 * Es más bajo que el de un pedido —20— a propósito: un pedido acumula
 * imágenes de referencia del cliente, y una tarea acumula fotos del avance,
 * que es un flujo que no termina solo.
 */
export const MAX_ATTACHMENTS_PER_TASK = 15;

/** Ranuras libres. Nunca negativo, aunque el conteo llegue por encima del tope. */
export function remainingSlots(
  activeCount: number,
  limit: number = MAX_ATTACHMENTS_PER_TASK,
): number {
  return Math.max(0, limit - activeCount);
}

/**
 * ¿Cabe el lote entero?
 *
 * Un lote se acepta o se rechaza completo: arrastrar cinco archivos sobre una
 * tarea que tiene trece no debe dejarla con quince y dos errores. La pantalla
 * lo comprueba antes de comprimir nada; la acción lo vuelve a comprobar por
 * si dos personas adjuntan a la vez (design D5).
 */
export function fitsBatch(
  activeCount: number,
  batchSize: number,
  limit: number = MAX_ATTACHMENTS_PER_TASK,
): boolean {
  return batchSize <= remainingSlots(activeCount, limit);
}

/** El mensaje del rechazo, uno solo, para que pantalla y acción digan lo mismo. */
export function batchLimitMessage(
  activeCount: number,
  batchSize: number,
  limit: number = MAX_ATTACHMENTS_PER_TASK,
): string {
  const libres = remainingSlots(activeCount, limit);

  if (libres === 0) {
    return `Esta tarea ya tiene ${limit} adjuntos, el máximo. Quita alguno para agregar otro.`;
  }

  const plural = libres === 1 ? "" : "s";
  return `Solo caben ${libres} adjunto${plural} más en esta tarea (máximo ${limit}) y estás agregando ${batchSize}.`;
}

/** ¿El archivo cabe por peso? El tope es del bucket, y se avisa antes de subir. */
export function fitsFileSize(sizeBytes: number): boolean {
  return sizeBytes <= MAX_FILE_SIZE;
}

export const FILE_TOO_LARGE_MESSAGE =
  "Un adjunto no puede pesar más de 5 MB.";
