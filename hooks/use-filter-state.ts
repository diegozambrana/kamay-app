"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * El estado de los filtros de una vista, leído de la dirección (design D2).
 *
 * Cada pantalla declara **cuáles** de sus parámetros son filtros: la búsqueda
 * o la categoría estrechan el resultado; la vista (`view`), la página o
 * «incluir archivados» no. La línea activa tampoco lo es: viaja en una
 * cookie como contexto de toda la aplicación, y el vacío de una línea se
 * resuelve con su propio mensaje, no ofreciendo quitarla.
 *
 * Con ese dato la vista elige entre vacío inicial y sin resultados. Decidirlo
 * por el conteo de filas produce el error clásico: una organización vacía con
 * un filtro puesto ofrece «Quitar filtros» y, al quitarlos, sigue vacía.
 */
export function useFilterState(filterKeys: readonly string[]) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const hasActiveFilters = filterKeys.some((key) => {
    const value = params.get(key);
    return value !== null && value !== "";
  });

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    for (const key of filterKeys) next.delete(key);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [filterKeys, params, pathname, router]);

  return { hasActiveFilters, clearFilters };
}

/**
 * La clave con la que reiniciar un campo de búsqueda **no controlado** cuando
 * «Quitar filtros» lo vacía.
 *
 * El campo no puede usar el texto de búsqueda como clave: en las pantallas que
 * navegan en cada tecla se remontaría a cada letra y perdería el foco. Y no
 * basta con cambiar la clave al pulsar «Quitar filtros»: el campo se
 * remontaría antes de que llegue la búsqueda vacía del servidor, con el texto
 * viejo. Se arma al quitar y se dispara una sola vez, cuando la búsqueda ya
 * llegó vacía.
 */
export function useSearchReset(search: string) {
  const [state, setState] = useState({ key: 0, armed: false });

  // Ajuste de estado durante el render por cambio de props: el patrón que
  // React recomienda en lugar de un efecto que vuelva a rendir.
  if (state.armed && search === "") {
    setState({ key: state.key + 1, armed: false });
  }

  const armSearchReset = useCallback(
    () => setState((current) => ({ ...current, armed: true })),
    [],
  );

  return { searchKey: state.key, armSearchReset };
}
