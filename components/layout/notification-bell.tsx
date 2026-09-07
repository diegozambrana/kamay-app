"use client";

import { BellIcon } from "lucide-react";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Campana de notificaciones de la barra superior.
 *
 * Es uno de los elementos siempre disponibles del cascarón (mapa §4.1) y la
 * puerta de la bandeja V21, que llega con los avisos y recordatorios
 * (KAM-17). Su sitio se cierra aquí para no volver a tocar la barra superior
 * cuando exista el contenido: entonces solo cambiarán la fuente del contador
 * y lo que este panel muestra.
 *
 * Mientras tanto no enlaza a `/notifications`: esa ruta no existe y un 404
 * sería peor que una explicación (design D9). Y la insignia no se pinta
 * cuando no hay nada sin leer —un "0" permanente enseña a ignorar la
 * campana, que es justo lo contrario de lo que una campana debe conseguir—.
 *
 * La ven ambos roles: los avisos de entrega y de tarea son del ayudante tanto
 * como de la persona dueña.
 */
export function NotificationBell({ unreadCount = 0 }: { unreadCount?: number }) {
  const [open, setOpen] = useState(false);
  const hasUnread = unreadCount > 0;

  return (
    <>
      <button
        type="button"
        data-testid="notification-bell"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          hasUnread
            ? `Notificaciones, ${unreadCount} sin leer`
            : "Notificaciones"
        }
        onClick={() => setOpen(true)}
        className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <BellIcon className="size-4" aria-hidden />
        {hasUnread && (
          <span
            data-testid="notification-badge"
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] leading-4 font-medium text-white tabular-nums"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" data-testid="notification-panel">
          <SheetHeader>
            <SheetTitle>Notificaciones</SheetTitle>
          </SheetHeader>

          <p className="px-4 text-sm text-muted-foreground">
            La bandeja de notificaciones todavía no está disponible. Llegará
            con los recordatorios y los avisos.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
