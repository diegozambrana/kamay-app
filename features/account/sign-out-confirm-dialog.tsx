"use client";

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

/**
 * Confirmación de "Cerrar sesión" cuando hay registros pendientes de
 * sincronizar (KAM-24). Compartida por `UserMenu` (escritorio) y el bloque de
 * cuenta del panel "Más" (móvil): la pregunta es la misma en las dos
 * superficies.
 */
export function SignOutConfirmDialog({
  open,
  onOpenChange,
  pending,
  pendingCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  pendingCount: number;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Cerrar sesión con registros pendientes?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tienes {pendingCount}{" "}
            {pendingCount === 1 ? "registro" : "registros"} por sincronizar en
            este dispositivo. Seguirán guardados aquí, pero no se subirán
            hasta que vuelvas a entrar con conexión.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            data-testid="confirm-sign-out"
            onClick={(event) => {
              // El diálogo se cierra explícitamente al confirmar; el cierre de
              // sesión redirige, así que no hace falta esperar una respuesta.
              event.preventDefault();
              onConfirm();
            }}
          >
            Cerrar sesión
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
