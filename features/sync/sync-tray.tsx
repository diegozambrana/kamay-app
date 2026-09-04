"use client";

import { AlertTriangle, Clock, PauseCircle } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format/datetime";
import { useOrganizationStore } from "@/stores/organization-store";
import { holdMessage } from "@/lib/offline";
import { getOperation } from "@/lib/offline";
import type { SyncItem } from "@/stores/sync-store";

/**
 * La bandeja de registros no sincronizados.
 *
 * Existe por el criterio 6 del backlog: un registro que falla de forma
 * permanente se muestra con la opción de reintentar o descartar, y nunca se
 * pierde en silencio. Lo pendiente también se lista, porque la pregunta que
 * trae aquí a la persona —«¿se guardó lo que registré?»— es la misma.
 */

function describeEntry(item: SyncItem): string {
  const operation = getOperation(item.entry.operation);
  return operation?.describe(item.entry.payload) ?? "Registro pendiente";
}

function statusOf(item: SyncItem) {
  if (item.entry.state === "failed") {
    return {
      icon: AlertTriangle,
      label: "No se pudo enviar",
      detail: item.entry.lastError ?? "El servidor rechazó este registro.",
      tone: "text-destructive",
    };
  }

  if (item.hold) {
    return {
      icon: PauseCircle,
      label: "En espera",
      detail: holdMessage(item.hold),
      tone: "text-muted-foreground",
    };
  }

  return {
    icon: Clock,
    label: "Pendiente de sincronizar",
    detail: "Se enviará solo en cuanto haya conexión.",
    tone: "text-muted-foreground",
  };
}

export function SyncTray({
  open,
  onOpenChange,
  items,
  onRetry,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SyncItem[];
  onRetry: (seq: number) => void;
  onDiscard: (seq: number) => void;
}) {
  // La hora se cuenta en la zona del taller, como toda hora visible.
  const timezone = useOrganizationStore((state) => state.organization?.timezone);

  // Descartar es la única forma en que un registro desaparece sin haberse
  // enviado. Por eso se pregunta antes, aunque el resto de la bandeja no
  // pregunte nada.
  const [discarding, setDiscarding] = useState<SyncItem | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registros por sincronizar</SheetTitle>
          <SheetDescription>
            Lo que registraste sin conexión se guarda aquí y se envía solo.
            Nada se borra sin que tú lo decidas.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No queda nada por sincronizar.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => {
                const status = statusOf(item);
                const Icon = status.icon;
                const failed = item.entry.state === "failed";

                return (
                  <li
                    key={item.entry.seq}
                    data-testid="sync-item"
                    className="rounded-lg border p-3"
                  >
                    <p className="text-sm font-medium">{describeEntry(item)}</p>

                    <p className={`mt-1 flex items-center gap-1.5 text-xs ${status.tone}`}>
                      <Icon className="size-3.5 shrink-0" aria-hidden />
                      {status.label}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">{status.detail}</p>

                    {/* La hora real del hecho, no la de la sincronización. */}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Registrado el {formatDateTime(item.entry.enqueuedAt, timezone ?? "UTC")}
                    </p>

                    {failed && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onRetry(item.entry.seq)}
                        >
                          Reintentar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDiscarding(item)}
                          data-testid="discard-entry"
                        >
                          Descartar
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>

      <AlertDialog
        open={discarding !== null}
        onOpenChange={(open) => !open && setDiscarding(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              No se ha guardado en el servidor y no se podrá recuperar. Si lo
              descartas, tendrás que volver a registrarlo a mano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-discard"
              onClick={(event) => {
                event.preventDefault();
                if (discarding) onDiscard(discarding.entry.seq);
                setDiscarding(null);
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
