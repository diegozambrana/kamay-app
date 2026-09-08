"use client";

import { FileIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FileDropzone } from "@/components/file-dropzone/file-dropzone";
import { Button } from "@/components/ui/button";
import { RECEIPT_INPUT_MAX_BYTES } from "@/lib/attachments/compress-image";
import {
  MAX_ATTACHMENTS_PER_TASK,
  batchLimitMessage,
  fitsBatch,
  remainingSlots,
} from "@/lib/attachments/limits";
import { formatFileSize } from "@/lib/format/file-size";

import { hasPendingUploads, uploadsForTask, useTaskUploadStore } from "./upload-store";

export type TaskAttachment = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedByName: string | null;
  /** URL firmada: los buckets son privados, nada se muestra por URL pública. */
  url: string | null;
};

export type AttachmentPanelProps = {
  taskId: string;
  attachments: TaskAttachment[];
  onDetach: (attachmentId: string) => Promise<{ error: string } | undefined>;
  /** Una tarea archivada conserva sus adjuntos, pero no admite más. */
  readOnly?: boolean;
};

function esImagen(mimeType: string | null): boolean {
  return (mimeType ?? "").startsWith("image/");
}

/**
 * Los adjuntos de la tarea: arrastrar o elegir del equipo, con miniatura para
 * las imágenes y ficha para lo demás.
 *
 * La subida ocurre en segundo plano (design D4): mientras un adjunto viaja, el
 * título, el cuerpo y los campos de la tarea siguen editables. Eso es lo que
 * obliga a que la cola viva en un store y no en el estado de este componente.
 */
export function AttachmentPanel({
  taskId,
  attachments,
  onDetach,
  readOnly = false,
}: AttachmentPanelProps) {
  // Se selecciona la lista **entera**, que es una referencia estable, y se
  // filtra fuera del selector. Filtrar dentro devolvería un array nuevo en
  // cada lectura, y `useSyncExternalStore` lo tomaría por un estado nuevo: la
  // pantalla entra en un bucle de renderizado y no llega a pintarse.
  const allUploads = useTaskUploadStore((state) => state.uploads);
  const uploads = useMemo(
    () => uploadsForTask(allUploads, taskId),
    [allUploads, taskId],
  );
  const enqueue = useTaskUploadStore((state) => state.enqueue);
  const dismiss = useTaskUploadStore((state) => state.dismiss);

  const [error, setError] = useState<string | null>(null);
  const [enLinea, setEnLinea] = useState(true);

  // Los adjuntos exigen conexión, igual que los de pedido: no entran en la
  // cola de captura sin conexión. Sin red se avisa, y el resto de la tarea
  // sigue editable y guardable.
  useEffect(() => {
    const sync = () => setEnLinea(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Aviso al salir de la página con algo a medio subir.
  useEffect(() => {
    if (!hasPendingUploads(uploads)) return;
    const avisar = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [uploads]);

  const vigentes = attachments.length + uploads.filter((u) => u.status === "pending").length;
  const libres = remainingSlots(vigentes);

  function recibir(files: File[]) {
    setError(null);

    if (!enLinea) {
      setError("Sin conexión no se pueden adjuntar archivos. El resto de la tarea sí se guarda.");
      return;
    }

    // El lote se acepta o se rechaza entero: trece adjuntos y cinco
    // arrastrados no deben dejar la tarea en quince y dos errores (design D5).
    if (!fitsBatch(vigentes, files.length)) {
      setError(batchLimitMessage(vigentes, files.length));
      return;
    }

    void enqueue(taskId, files);
  }

  async function quitar(attachmentId: string) {
    setError(null);
    const result = await onDetach(attachmentId);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="attachment-panel">
      {!readOnly && (
        <FileDropzone
          value={[]}
          onChange={recibir}
          // La validación real la hace este panel: el límite del lote depende
          // de cuántos adjuntos hay ya en el servidor, y las imágenes grandes
          // se comprimen en vez de rechazarse.
          maxFiles={Number.MAX_SAFE_INTEGER}
          maxSizeBytes={RECEIPT_INPUT_MAX_BYTES}
          // No se deshabilita aunque esté llena o sin red: una zona
          // deshabilitada se traga el arrastre en silencio, y el requisito es
          // impedir **con mensaje claro**. Se deja recibir para poder explicar
          // por qué no entra.
          label="Arrastra fotos o archivos aquí"
          description={
            libres === 0
              ? `Esta tarea ya tiene ${MAX_ATTACHMENTS_PER_TASK} adjuntos, el máximo.`
              : `o elígelos del equipo. Quedan ${libres} de ${MAX_ATTACHMENTS_PER_TASK}. Las imágenes se comprimen solas; el resto, hasta 5 MB.`
          }
        />
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {attachments.length === 0 && uploads.length === 0 && (
        <p className="text-muted-foreground text-sm" data-testid="empty-attachments">
          Todavía no hay adjuntos.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {uploads.map((upload) => (
          <li
            key={upload.id}
            data-testid="attachment-upload"
            data-status={upload.status}
            className="bg-muted/40 flex items-center gap-3 rounded-lg border p-2 text-sm"
          >
            {upload.status === "pending" ? (
              <Loader2Icon className="text-muted-foreground size-4 shrink-0 animate-spin" />
            ) : (
              <FileIcon className="text-destructive size-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{upload.fileName}</p>
              <p className="text-muted-foreground text-xs">
                {upload.status === "pending" ? "Subiendo…" : upload.error}
              </p>
            </div>
            {upload.status === "failed" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => dismiss(upload.id)}
              >
                Descartar
              </Button>
            )}
          </li>
        ))}

        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            data-testid="attachment"
            data-size-bytes={attachment.sizeBytes ?? undefined}
            className="flex items-center gap-3 rounded-lg border p-2 text-sm"
          >
            {esImagen(attachment.mimeType) && attachment.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachment.url}
                alt={attachment.fileName}
                data-testid="attachment-thumbnail"
                className="size-12 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="bg-muted flex size-12 shrink-0 items-center justify-center rounded">
                <FileIcon className="text-muted-foreground size-5" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{attachment.fileName}</p>
              <p className="text-muted-foreground text-xs">
                {attachment.sizeBytes === null
                  ? "—"
                  : formatFileSize(attachment.sizeBytes)}
                {attachment.uploadedByName && ` · subido por ${attachment.uploadedByName}`}
              </p>
            </div>

            {attachment.url && (
              <Button asChild variant="ghost" size="sm">
                <a href={attachment.url} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              </Button>
            )}

            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar ${attachment.fileName}`}
                onClick={() => void quitar(attachment.id)}
              >
                <XIcon className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
