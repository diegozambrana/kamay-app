import { normalizeForSearch } from "@/lib/search/normalize";
import type { Contact, ContactRoleFilter, Item, ItemKind } from "@/types";

/** Lo que el catálogo está mostrando: la pestaña y sus filtros. */
export type CatalogScope = {
  kind: ItemKind;
  /** `"all"`, `"shared"` o el id de una línea, como en `ItemService.list()`. */
  lineFilter: string;
  /** `"all"`, `"none"` (sin categoría) o el id de una categoría del tipo. */
  categoryFilter: string;
  search: string;
  includeArchived: boolean;
};

/**
 * ¿El ítem que se acaba de crear cabe en lo que la pantalla muestra?
 *
 * El catálogo trae una ventana alfabética (KAM-23): quien crea «Zapatos» en un
 * catálogo de más de una vuelta no lo vería aparecer, y parecería que no se
 * guardó. Por eso la página lo trae aparte —como el contacto abierto por
 * enlace en el directorio—, pero **solo si los filtros vigentes lo habrían
 * mostrado**: un insumo creado desde la pestaña de productos, o de otra línea,
 * no se cuela en una lista que no es la suya. Las reglas son las mismas que
 * `ItemService.list()` aplica en la base.
 */
export function joinsCatalogWindow(item: Item, scope: CatalogScope): boolean {
  if (item.kind !== scope.kind) return false;
  if (item.archivedAt !== null && !scope.includeArchived) return false;

  if (scope.lineFilter === "shared" && item.businessLineId !== null) return false;
  if (
    scope.lineFilter !== "all" &&
    scope.lineFilter !== "shared" &&
    item.businessLineId !== scope.lineFilter
  ) {
    return false;
  }

  if (scope.categoryFilter === "none" && item.categoryId !== null) return false;
  if (
    scope.categoryFilter !== "all" &&
    scope.categoryFilter !== "none" &&
    item.categoryId !== scope.categoryFilter
  ) {
    return false;
  }

  const term = normalizeForSearch(scope.search);
  return term === "" || normalizeForSearch(item.name).includes(term);
}

/** Lo que el directorio está mostrando. */
export type ContactScope = {
  role: ContactRoleFilter;
  search: string;
  includeArchived: boolean;
};

/**
 * ¿El contacto abierto por enlace —o recién creado— cabe en lo que el
 * directorio muestra? La misma pregunta que `joinsCatalogWindow`, con las
 * reglas de `ContactService.list()`. Sin ella, un contacto recién creado y
 * archivado a continuación seguía en la lista, porque la dirección aún lo
 * nombraba.
 */
export function joinsContactWindow(contact: Contact, scope: ContactScope): boolean {
  if (contact.archivedAt !== null && !scope.includeArchived) return false;
  if (scope.role === "supplier" && !contact.isSupplier) return false;
  if (scope.role === "customer" && !contact.isCustomer) return false;

  const term = normalizeForSearch(scope.search);
  return term === "" || normalizeForSearch(contact.name).includes(term);
}
