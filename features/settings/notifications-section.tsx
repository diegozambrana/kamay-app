"use client";

import { useState, useTransition } from "react";

import { saveNotificationPreferences } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type {
  NotificationPreferences,
  NotificationType,
} from "@/lib/notifications/types";

/**
 * Cada tipo con su rótulo y una línea que dice cuándo llega.
 *
 * `stock_below_min` aparece con su nota: el interruptor existe y se puede
 * apagar desde ya —para no volver a tocar la tabla cuando KAM-18 encienda su
 * generador—, y decir a qué fase pertenece evita que se lea como una promesa
 * incumplida.
 */
const TYPES: { type: NotificationType; label: string; note: string }[] = [
  {
    type: "due_summary",
    label: "Resumen diario",
    note: "Un solo aviso al día con lo que vence, nunca uno por tarea.",
  },
  {
    type: "task_assigned",
    label: "Tarea asignada",
    note: "Cuando alguien te asigna una tarea. También por correo.",
  },
  {
    type: "task_overdue",
    label: "Tarea vencida",
    note: "Cuando pasa la fecha límite de una tarea tuya. También por correo.",
  },
  {
    type: "task_review",
    label: "Tarea en revisión",
    note: "Cuando una tarea tuya queda a la espera de revisión.",
  },
  {
    type: "task_stalled",
    label: "Tarea sin movimiento",
    note: "Cuando una tarea lleva más de una semana en curso sin moverse.",
  },
  {
    type: "stock_below_min",
    label: "Insumo bajo mínimo",
    note: "Cuando un insumo baja de su mínimo. Llegará con el inventario.",
  },
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * Las preferencias de notificación de quien las mira.
 *
 * **Son suyas, no de la organización.** Es la única sección de V15 abierta a
 * los dos roles, y la razón es esa: un ayudante que no puede silenciar sus
 * propios avisos acaba silenciando el correo entero (design D1).
 */
export function NotificationsSection({
  initial,
}: {
  initial: NotificationPreferences;
}) {
  const [preferences, setPreferences] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => {
    setSaved(false);
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await saveNotificationPreferences(preferences);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-6">
      <div className="space-y-4">
        {TYPES.map(({ type, label, note }) => (
          <div key={type} className="flex items-start gap-3">
            <Checkbox
              id={`pref-${type}`}
              checked={preferences[type]}
              onCheckedChange={(checked) => set(type, checked === true)}
            />
            <div className="-mt-0.5">
              <Label htmlFor={`pref-${type}`}>{label}</Label>
              <p className="text-xs text-muted-foreground">{note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 border-t pt-4">
        <Label htmlFor="pref-hour">Hora del resumen diario</Label>
        <select
          id="pref-hour"
          className="h-9 w-32 rounded-md border bg-transparent px-2 text-sm"
          value={preferences.dailySummaryHour}
          onChange={(event) =>
            set("dailySummaryHour", Number(event.target.value))
          }
        >
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, "0")}:00
            </option>
          ))}
        </select>
        {/* El trabajo corre cada hora, así que el envío cae dentro de la hora
            elegida y no al minuto (design D4). Decirlo aquí evita que el
            desfase se lea como un fallo. */}
        <p className="text-xs text-muted-foreground">
          El resumen llega alrededor de esa hora, en el horario de tu taller.
        </p>
      </div>

      <div className="flex items-start gap-3 border-t pt-4">
        <Checkbox
          id="pref-email"
          checked={preferences.emailEnabled}
          onCheckedChange={(checked) => set("emailEnabled", checked === true)}
        />
        <div className="-mt-0.5">
          <Label htmlFor="pref-email">Recibir también por correo</Label>
          <p className="text-xs text-muted-foreground">
            Solo el resumen, lo vencido y lo asignado. Apagarlo no quita los
            avisos de aquí dentro.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          Cambios guardados.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        Guardar
      </Button>
    </form>
  );
}
