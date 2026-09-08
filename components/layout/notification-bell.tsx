"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NotificationList } from "@/features/notifications/notification-list";
import type { NotificationGroup } from "@/types";

/**
 * Campana de notificaciones de la barra superior, y puerta de la bandeja V21.
 *
 * Es uno de los elementos siempre disponibles del cascarón (mapa §4.1). La
 * insignia no se pinta cuando no hay nada sin leer —un "0" permanente enseña a
 * ignorar la campana, que es justo lo contrario de lo que una campana debe
 * conseguir—.
 *
 * La ven ambos roles: los avisos de entrega y de tarea son del ayudante tanto
 * como de la persona dueña, y sus preferencias también (design D1).
 *
 * El contador se cuenta en el servidor al componer el cascarón, no por
 * suscripción: un aviso que aparece medio minuto tarde no le cuesta nada a un
 * taller de tres personas, y una suscripción por organización sí cuesta
 * complejidad (design, *Non-Goals*).
 */
export function NotificationBell({
  unreadCount = 0,
  groups = [],
  timezone = "UTC",
}: {
  unreadCount?: number;
  groups?: NotificationGroup[];
  timezone?: string;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
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

          <NotificationList
            groups={groups}
            timezone={timezone}
            onMarkRead={(id) =>
              startTransition(() => {
                void markNotificationRead({ notificationId: id });
              })
            }
            onMarkAllRead={() =>
              startTransition(() => {
                void markAllNotificationsRead();
              })
            }
          />

          {/* El mapa manda V21 → Preferencias → V15 → Notificaciones, y esa
              sección está abierta a los dos roles (design D6). */}
          <div className="border-t px-4 pt-3">
            <Link
              href="/settings/notifications"
              className="text-sm text-muted-foreground hover:underline"
              onClick={() => setOpen(false)}
            >
              Preferencias de notificación
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
