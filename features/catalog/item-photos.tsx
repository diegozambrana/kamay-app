"use client";

import { useState, useTransition } from "react";

import { setItemPhotoArchived } from "@/actions/catalog";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatFileSize } from "@/lib/format/file-size";
import type { Attachment, Role } from "@/types";

/** Un adjunto con su URL ya firmada por el servidor. */
export type ItemPhoto = Attachment & { url: string | null };

/**
 * Fotografías del ítem en el detalle (V11).
 *
 * Las URLs llegan firmadas desde el servidor porque el bucket es privado; una
 * firma caducada deja la tarjeta sin imagen pero con el nombre y el peso, que
 * es información útil por sí sola.
 */
export function ItemPhotos({
  itemId,
  photos,
  role,
  readOnly,
}: {
  itemId: string;
  photos: ItemPhoto[];
  role: Role;
  /** El ítem está archivado: no se toca nada suyo hasta desarchivarlo. */
  readOnly: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ItemPhoto | null>(null);
  const [pending, startTransition] = useTransition();

  const isOwner = role === "owner";

  function remove(photo: ItemPhoto) {
    setError(null);
    startTransition(async () => {
      const result = await setItemPhotoArchived({
        id: photo.id,
        itemId,
        archived: true,
      });
      if (result?.error) setError(result.error);
      setRemoving(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fotografía</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo quitar la foto</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {photos.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyTitle>Sin fotografía</EmptyTitle>
              <EmptyDescription>
                {readOnly
                  ? "Este ítem no tiene ninguna foto."
                  : "Puedes adjuntar una desde «Editar»."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul data-testid="item-photos" className="flex flex-wrap gap-4">
            {photos.map((photo) => (
              <li
                key={photo.id}
                data-testid="item-photo"
                className="flex w-56 flex-col gap-2"
              >
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada y efímera: no pasa por el optimizador
                  <img
                    src={photo.url}
                    alt={`Fotografía de ${photo.fileName}`}
                    className="aspect-square w-full rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    Vista no disponible
                  </div>
                )}

                <div className="flex flex-col">
                  <span className="truncate text-sm font-medium">
                    {photo.fileName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {photo.sizeBytes === null
                      ? "—"
                      : formatFileSize(photo.sizeBytes)}
                  </span>
                </div>

                {/* Quitar una foto es archivarla: el objeto sigue en el
                    bucket y los registros que la referencian no cambian. */}
                {!readOnly && isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setRemoving(photo)}
                  >
                    Quitar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar esta fotografía?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de verse en el catálogo y en este detalle. El archivo no se
              borra: queda archivado por si hace falta recuperarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && remove(removing)}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
