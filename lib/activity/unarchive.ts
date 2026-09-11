/**
 * Qué tablas se pueden desarchivar desde su evento de bitácora.
 *
 * Vive en `lib/` porque la necesitan los dos lados: la acción, para despachar
 * a la acción de dominio que corresponda, y la fila, para decidir si pinta el
 * botón. Un archivo `"use server"` no puede exportar una constante, así que la
 * lista tiene que estar fuera de `actions/` o estaría escrita dos veces —y una
 * de las dos se quedaría atrás el día que se añada la novena—.
 */

/**
 * Las tablas cuyo desarchivado tiene una acción de dominio a la que delegar
 * **con solo el `record_id` que el evento guarda**.
 *
 * Fuera quedan, a propósito:
 * - `tasks`: `TaskService` tiene `archive()` y no su inverso.
 * - `item_variants` y `asset_details`: sus acciones piden también el ítem al
 *   que pertenecen, y el evento no lo guarda (design D14).
 * - Las líneas de pedido y de egreso: se archivan con su documento, no solas.
 */
export const UNARCHIVABLE_TABLES = [
  "orders",
  "expenses",
  "contacts",
  "items",
  "business_lines",
  "sales_channels",
  "expense_categories",
  "units",
] as const;

export type UnarchivableTable = (typeof UNARCHIVABLE_TABLES)[number];

/** ¿El evento de archivado de esta tabla puede ofrecer desarchivar? */
export function isUnarchivable(
  tableName: string,
): tableName is UnarchivableTable {
  return (UNARCHIVABLE_TABLES as readonly string[]).includes(tableName);
}
