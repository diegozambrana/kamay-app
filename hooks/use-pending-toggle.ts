"use client";

import { useState } from "react";

/**
 * Un interruptor cuyo valor real lo decide el servidor —vive en la dirección—
 * pero que debe responder al instante.
 *
 * Sin esto, marcar "Ver archivados" no cambia nada hasta que la navegación
 * termina: la casilla se ve muerta un momento, y quien la pulsa vuelve a
 * pulsarla. El valor local manda mientras el servidor responde; cuando llega
 * el nuevo valor, el servidor recupera la última palabra.
 *
 * Es el patrón de ajuste de estado durante el render que documenta React, no
 * un efecto: no hay render intermedio con el valor viejo.
 */
export function usePendingToggle(
  serverValue: boolean,
): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(serverValue);
  const [lastServerValue, setLastServerValue] = useState(serverValue);

  if (lastServerValue !== serverValue) {
    setLastServerValue(serverValue);
    setValue(serverValue);
  }

  return [value, setValue];
}
