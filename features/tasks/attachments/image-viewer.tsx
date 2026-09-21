"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { TaskAttachment } from "./attachment-panel";

export type ImageViewerProps = {
  /** **Todas** las imágenes de la tarea, en el orden de la lista. */
  images: TaskAttachment[];
  /** Índice de la que se está mirando, o `null` si el visor está cerrado. */
  index: number | null;
  /** Mueve el visor a otra imagen. */
  onIndexChange: (next: number) => void;
  onClose: () => void;
  /** Quitar desde el visor. Resuelve con el error si lo hubo. */
  onDetach?: (attachmentId: string) => Promise<{ error: string } | undefined>;
};

/**
 * El visor de imágenes adjuntas (design D4).
 *
 * Recibe **todas** las imágenes y no la que se abrió: es lo que permite pasar
 * a la siguiente sin cerrar el visor, y lo que deja decidir a dónde ir cuando
 * se quita la que se está mirando.
 *
 * El cierre con `Esc`, el foco atrapado y el fondo los pone `Dialog`; aquí
 * solo se añade la navegación con las flechas, que es lo que se espera de un
 * visor y lo que `Dialog` no puede saber.
 *
 * El índice **no se duplica aquí**: lo lleva el panel, que es quien sabe qué
 * imagen se activó. Guardarlo en este componente obligaría a sincronizarlo con
 * la prop desde un efecto, que es exactamente la clase de estado derivado que
 * se desincroniza.
 */
export function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
  onDetach,
}: ImageViewerProps) {
  const [error, setError] = useState<string | null>(null);

  const open = index !== null && images.length > 0;
  // La lista puede encoger mientras el visor está abierto: el índice se acota
  // al leerlo, no al guardarlo.
  const safeIndex = index === null ? 0 : Math.min(index, images.length - 1);
  const current = open ? (images[safeIndex] ?? null) : null;
  const many = images.length > 1;

  function go(delta: number) {
    const next = safeIndex + delta;
    if (next < 0) onIndexChange(images.length - 1);
    else if (next >= images.length) onIndexChange(0);
    else onIndexChange(next);
  }

  useEffect(() => {
    if (!open || !many) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, many, images.length, safeIndex]);

  async function detach() {
    if (!current || !onDetach) return;
    setError(null);

    const result = await onDetach(current.id);
    if (result?.error) {
      setError(result.error);
      return;
    }

    // Quitar deja al visor sobre una imagen que ya no existe: pasa a la
    // siguiente, y si era la última se cierra. Dejarlo abierto sería mentir.
    if (images.length <= 1) onClose();
    else onIndexChange(Math.min(safeIndex, images.length - 2));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-3xl" data-testid="image-viewer">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {current?.fileName ?? "Imagen"}
          </DialogTitle>
          <DialogDescription>
            {many
              ? `Imagen ${safeIndex + 1} de ${images.length}`
              : "Adjunto de la tarea"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {many && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Imagen anterior"
              onClick={() => go(-1)}
            >
              <ChevronLeftIcon className="size-5" />
            </Button>
          )}

          <div className="bg-muted/30 flex min-h-64 flex-1 items-center justify-center overflow-hidden rounded-lg">
            {current?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.url}
                alt={current.fileName}
                data-testid="viewer-image"
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            ) : (
              <p className="text-muted-foreground p-6 text-sm">
                No se pudo cargar esta imagen.
              </p>
            )}
          </div>

          {many && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Imagen siguiente"
              onClick={() => go(1)}
            >
              <ChevronRightIcon className="size-5" />
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {current?.url && (
            <Button asChild variant="outline" size="sm">
              <a href={current.url} target="_blank" rel="noreferrer">
                Abrir original
              </a>
            </Button>
          )}
          {onDetach && current && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="viewer-detach"
              onClick={() => void detach()}
            >
              Quitar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
