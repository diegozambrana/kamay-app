"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

/**
 * Salir de un formulario con datos escritos pide confirmación (mapa de
 * navegación §8; design.md D8).
 *
 * Cubre las dos salidas que el formulario controla —el botón «Cancelar» y el
 * enlace de volver— y, con `beforeunload`, la recarga y el cierre de pestaña.
 * Los enlaces del menú lateral no se interceptan: el App Router no expone un
 * bloqueo de navegación, y envolver el shell entero por un formulario sería
 * desproporcionado. En móvil la barra inferior se oculta en las rutas de
 * captura, así que ahí esta guardia cubre todo lo que el usuario puede tocar.
 *
 * Volver usa `router.back()` a propósito: devuelve a la pantalla anterior con
 * sus filtros y su vista intactos, que es lo que pide la regla de retorno.
 */
export function DiscardGuard({
  dirty,
  label = "Cancelar",
  children,
}: {
  /** Hay cambios sin guardar. Tras un guardado exitoso debe volver a `false`. */
  dirty: boolean;
  label?: string;
  /** Contenido del botón, si se quiere algo distinto del rótulo. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  // Recargar o cerrar la pestaña con cambios sin guardar. El navegador
  // muestra su propio aviso; no se puede personalizar el texto.
  useEffect(() => {
    if (!dirty) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function leave() {
    setAsking(false);
    router.back();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="discard-button"
        onClick={() => (dirty ? setAsking(true) : leave())}
      >
        {children ?? label}
      </Button>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Lo que escribiste en este formulario se perderá. Esta acción no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-discard" onClick={leave}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
