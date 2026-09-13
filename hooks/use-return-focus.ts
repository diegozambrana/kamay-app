"use client";

import { useRef } from "react";

/**
 * A dónde vuelve el foco cuando se cierra un diálogo o un panel (KAM-23, spec
 * `accessibility` → «A dialog traps and returns focus»).
 *
 * Radix devuelve el foco al `DialogTrigger`, pero en esta aplicación casi
 * todos los diálogos se abren con un botón que cambia un estado —«Nuevo
 * ítem», «Registrar cobro»— y no hay disparador: el foco caía en el `body`, y
 * quien navega con teclado tenía que volver a recorrer la página desde arriba.
 *
 * Se recuerda el elemento que tenía el foco al abrirse el contenido —el que
 * lo abrió— y se le devuelve al cerrar. `onOpenAutoFocus` es el momento
 * justo: Radix lo dispara al montar el contenido, antes de mover el foco
 * adentro. (El componente que envuelve el contenido se rinde también con el
 * diálogo cerrado, así que capturar en el render guardaría el `body`.)
 *
 * Si ese elemento ya no existe —un menú que se cerró al elegir—, el foco queda
 * donde Radix lo deje.
 */
export function useReturnFocus() {
  const origin = useRef<HTMLElement | null>(null);

  return {
    capture: () => {
      origin.current = document.activeElement as HTMLElement | null;
    },
    restore: (event: Event) => {
      const target = origin.current;
      origin.current = null;
      if (!target || !target.isConnected || target === document.body) return;
      event.preventDefault();
      target.focus();
    },
  };
}
