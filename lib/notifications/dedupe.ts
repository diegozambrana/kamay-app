/**
 * Las llaves de idempotencia (design D3).
 *
 * Cada llave nombra **el hecho**, no la pasada del trabajo que lo detectó. Esa
 * es toda la idea: mientras el hecho sea el mismo, la llave es la misma y el
 * `insert ... on conflict do nothing` no crea nada. En cuanto el hecho cambia
 * —la tarea se reprograma, vuelve a entrar en revisión, se mueve de estado—
 * la llave cambia y el aviso vuelve a tener sentido.
 *
 * Corolario que conviene tener presente al leerlas: **no aparece ninguna
 * fecha de ejecución en ninguna llave salvo la del resumen**, donde el hecho
 * *es* el día. Meter la fecha de la pasada en `task_overdue` produciría un
 * aviso diario por cada tarea vencida, que es exactamente el ruido que este
 * cambio existe para evitar.
 */

/**
 * El resumen del día. Aquí el hecho sí es el día: uno por persona y jornada,
 * cualquiera que sea el número de tareas que resuma.
 *
 * @param localDate el día en la zona de la organización, `YYYY-MM-DD`
 */
export function dueSummaryKey(localDate: string): string {
  return `due_summary:${localDate}`;
}

/**
 * Una asignación concreta. Reasignar a otra persona y devolverla a la primera
 * no vuelve a avisar a la primera, y es lo correcto: ya se lo dijimos.
 */
export function taskAssignedKey(taskId: string, assigneeId: string): string {
  return `task_assigned:${taskId}:${assigneeId}`;
}

/**
 * Una entrada en revisión. Lleva el estado y no la fecha, de modo que sacar la
 * tarea de revisión y devolverla **sí** vuelve a avisar —es un hecho nuevo—,
 * mientras que dejarla ahí una semana no repite nada.
 */
export function taskReviewKey(taskId: string, statusId: string): string {
  return `task_review:${taskId}:${statusId}`;
}

/**
 * Un vencimiento concreto. La llave lleva **la fecha límite**, no el día en
 * que se detectó: por eso una tarea tres días vencida tiene un solo aviso, y
 * por eso reprogramarla y volver a vencer sí avisa otra vez.
 *
 * @param dueDate la fecha límite en `YYYY-MM-DD`
 */
export function taskOverdueKey(taskId: string, dueDate: string): string {
  return `task_overdue:${taskId}:${dueDate}`;
}

/**
 * Un estancamiento concreto, identificado por cuándo entró la tarea en el
 * estado donde se quedó parada. Moverla y volver a dejarla parada es otro
 * estancamiento; no moverla no repite el aviso.
 *
 * @param statusSince cuándo entró en el estado actual, en ISO
 */
export function taskStalledKey(taskId: string, statusSince: string): string {
  return `task_stalled:${taskId}:${statusSince}`;
}
