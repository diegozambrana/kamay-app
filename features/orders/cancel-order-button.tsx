"use client";

import { useState, useTransition } from "react";

import { moveOrderToStatus } from "@/actions/orders";
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
import type { Status, StatusKind } from "@/types";

/**
 * Cancelar un pedido es moverlo al estado de tipo `cancelled` de su línea
 * (design.md D4). No hay acción nueva ni columna nueva: se reutiliza
 * `moveOrderToStatus`, que ya comprueba en el servidor que el destino
 * pertenece al juego resuelto de la línea del pedido.
 *
 * Cancelar **no archiva**: archivar es del dueño y saca el pedido del
 * tablero; un pedido cancelado sigue siendo información del día y se queda en
 * su columna.
 *
 * Si el juego de la línea no tiene ningún estado de tipo `cancelled`, la
 * acción no se ofrece: configurarlo es asunto de V22, no de este botón.
 */
export function CancelOrderButton({
  orderId,
  statuses,
  currentKind,
}: {
  orderId: string;
  /** El juego resuelto de la línea de ESTE pedido. */
  statuses: Status[];
  /** El tipo del estado actual, nunca su nombre (convención nº 5). */
  currentKind: StatusKind;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Se busca por `kind`: renombrar el estado no cambia nada.
  const target = statuses.find((status) => status.kind === "cancelled");

  if (!target || currentKind === "cancelled") return null;

  function cancel() {
    if (!target) return;
    setError(null);

    startTransition(async () => {
      const result = await moveOrderToStatus({
        orderId,
        statusId: target.id,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }
      setAsking(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        data-testid="cancel-order"
        onClick={() => setAsking(true)}
      >
        Cancelar pedido
      </Button>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Pasará a «{target.name}» y seguirá visible en el tablero, con su
              historial intacto. No se borra nada.
              {error && (
                <span className="mt-2 block text-destructive">{error}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              data-testid="confirm-cancel-order"
              onClick={(event) => {
                // El diálogo se cierra solo al confirmar; aquí se espera a que
                // la acción responda para poder mostrar su error.
                event.preventDefault();
                cancel();
              }}
            >
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
