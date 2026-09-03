/**
 * Límite de peso de un adjunto: 5 MB, la regla de crecimiento de la
 * especificación funcional.
 *
 * Vive en `lib/` y no en el componente porque lo comparten tres sitios que
 * deben coincidir: la zona de arrastre (para avisar antes de subir), la
 * Server Action (para no confiar en el cliente) y el bucket de Storage.
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Máximo de adjuntos por registro: la otra mitad de la misma regla de
 * crecimiento. La comparte todo lo que adjunta —fotos de ítem, imágenes de
 * referencia de un pedido— porque el límite es del registro, no del tipo.
 */
export const MAX_ATTACHMENTS_PER_RECORD = 20;

/** Tipos de imagen que aceptan los buckets de imágenes. */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/** Nombre con el que KAM-06 lo estrenó en la foto del ítem. */
export const ITEM_PHOTO_ACCEPT = IMAGE_ACCEPT;
