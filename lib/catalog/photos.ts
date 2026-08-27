/**
 * Límite de peso de un adjunto: 5 MB, la regla de crecimiento de la
 * especificación funcional.
 *
 * Vive en `lib/` y no en el componente porque lo comparten tres sitios que
 * deben coincidir: la zona de arrastre (para avisar antes de subir), la
 * Server Action (para no confiar en el cliente) y el bucket de Storage.
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Tipos de imagen que acepta el bucket `item-photos`. */
export const ITEM_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
