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
 * Cubre las salidas que el formulario controla —el botón «Cancelar» y las
 * migas de pan del encabezado (`useDiscardConfirm`)— y, con `beforeunload`,
 * la recarga y el cierre de pestaña.
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
  const { leave, dialog } = useDiscardConfirm(dirty);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="discard-button"
        onClick={() => leave(() => router.back())}
      >
        {children ?? label}
      </Button>

      {dialog}
    </>
  );
}

/**
 * La confirmación de descarte, separada del botón para que otras salidas —las
 * migas de pan— la compartan (design D4 de `navigation-breadcrumbs-…`).
 *
 * `leave(go)` ejecuta `go` directamente si no hay cambios y, si los hay,
 * pregunta primero. `confirmHref(href)` es el atajo para un enlace: se pasa
 * como `onClick` y, con cambios, evita la navegación del enlace hasta que la
 * persona acepte. Quien use el hook debe rendir `dialog`.
 */
export function useDiscardConfirm(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<(() => void) | null>(null);

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

  function leave(go: () => void) {
    if (dirty) setPending(() => go);
    else go();
  }

  function confirmHref(href: string) {
    return (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!dirty) return;
      event.preventDefault();
      setPending(() => () => router.push(href));
    };
  }

  function accept() {
    const go = pending;
    setPending(null);
    go?.();
  }

  const dialog = (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    >
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
          <AlertDialogAction data-testid="confirm-discard" onClick={accept}>
            Descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { leave, confirmHref, dialog };
}
