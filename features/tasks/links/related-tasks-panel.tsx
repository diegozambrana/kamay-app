"use client";

import { useEffect, useState } from "react";

import { relatedTasksFor } from "@/actions/tasks";
import type { RelatedTask } from "@/services/tasks/task-service";
import type { TaskLinkType } from "@/types";

import { RelatedTasks } from "./related-tasks";

export type RelatedTasksPanelProps = {
  entityType: TaskLinkType;
  /** `null` = no hay nada elegido todavía; no se consulta nada. */
  entityId: string | null;
  timezone: string;
};

/**
 * El bloque *Tareas relacionadas* para las pantallas que eligen en cliente:
 * el panel de contacto (V13) y el de activo (V12).
 *
 * Ahí el registro cambia sin recargar la página —«elegir un contacto SHALL
 * actualizar el panel derecho sin abandonar la página»—, así que el bloque
 * carga al cambiar la selección en vez de venir con el resto del servidor,
 * como sí hace en pedido e ítem.
 *
 * Una carga en vuelo cuya selección ya cambió se descarta: sin eso, elegir
 * rápido dos contactos puede dejar las tareas del primero bajo el segundo.
 */
export function RelatedTasksPanel({
  entityType,
  entityId,
  timezone,
}: RelatedTasksPanelProps) {
  const [tasks, setTasks] = useState<RelatedTask[]>([]);

  useEffect(() => {
    // Sin registro elegido no hay nada que pedir. La lista vacía se deriva al
    // rendir en vez de escribirse desde el efecto.
    if (entityId === null) return;

    let current = true;
    void relatedTasksFor(entityType, entityId).then((result) => {
      if (current) setTasks(result);
    });

    return () => {
      current = false;
    };
  }, [entityType, entityId]);

  return (
    <RelatedTasks
      tasks={entityId === null ? [] : tasks}
      timezone={timezone}
    />
  );
}
