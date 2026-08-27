"use client";

import { FileIcon, UploadIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MAX_FILE_SIZE } from "@/lib/catalog/photos";
import { formatFileSize } from "@/lib/format/file-size";
import { cn } from "@/lib/utils";

export type FileDropzoneProps = {
  /** Archivos elegidos. El componente no sube nada: eso es de quien lo usa. */
  value: File[];
  onChange: (files: File[]) => void;
  /** Tipos aceptados, en el formato del atributo `accept`. */
  accept?: string;
  maxFiles?: number;
  maxSizeBytes?: number;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
};

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Zona de arrastre reutilizable para elegir archivos.
 *
 * Deliberadamente no sabe nada de Supabase ni de qué se adjunta: entrega
 * `File[]` y deja la subida a quien lo usa. Nace para la foto del ítem
 * (KAM-06) y sirve igual para comprobantes de egreso (KAM-09) y adjuntos de
 * tarea (KAM-16), que es lo único que cambia entre ellos: `accept`.
 *
 * Muestra vista previa cuando el archivo es una imagen y el icono genérico
 * cuando no lo es, más el nombre y el peso de cada uno.
 */
export function FileDropzone({
  value,
  onChange,
  accept,
  maxFiles = 1,
  maxSizeBytes = MAX_FILE_SIZE,
  disabled = false,
  label = "Arrastra un archivo aquí",
  description,
  className,
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accepted(candidates: File[]): File[] {
    const room = maxFiles - value.length;
    if (room <= 0) {
      setError(
        maxFiles === 1
          ? "Solo se puede adjuntar un archivo."
          : `Solo se pueden adjuntar ${maxFiles} archivos.`,
      );
      return [];
    }

    const tooBig = candidates.filter((file) => file.size > maxSizeBytes);
    if (tooBig.length > 0) {
      setError(
        `${tooBig[0].name} pesa ${formatFileSize(tooBig[0].size)}: el máximo es ${formatFileSize(maxSizeBytes)}.`,
      );
    } else {
      setError(null);
    }

    return candidates
      .filter((file) => file.size <= maxSizeBytes)
      .slice(0, room);
  }

  function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next = accepted(Array.from(files));
    if (next.length > 0) onChange([...value, ...next]);
  }

  function remove(index: number) {
    setError(null);
    onChange(value.filter((_, position) => position !== index));
  }

  const full = value.length >= maxFiles;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {!full && (
        <div
          data-testid="file-dropzone"
          data-dragging={dragging || undefined}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) add(event.dataTransfer.files);
          }}
          className={cn(
            "rounded-lg border border-dashed transition-colors",
            dragging && "border-primary bg-primary/5",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <Empty className="py-6">
            <EmptyMedia variant="icon">
              <UploadIcon />
            </EmptyMedia>
            <EmptyTitle>{label}</EmptyTitle>
            <EmptyDescription>
              {description ??
                `o elígelo desde tu equipo. Máximo ${formatFileSize(maxSizeBytes)}.`}
            </EmptyDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Elegir archivo
            </Button>
          </Empty>

          {/* El input real queda fuera de la vista pero sigue siendo el que
              abre el explorador y el que leen las pruebas y los lectores de
              pantalla. */}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            accept={accept}
            multiple={maxFiles > 1}
            disabled={disabled}
            aria-label={label}
            onChange={(event) => {
              add(event.target.files);
              // Permite volver a elegir el mismo archivo tras quitarlo.
              event.target.value = "";
            }}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {value.length > 0 && (
        <ul data-testid="file-dropzone-list" className="flex flex-col gap-2">
          {value.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border px-3 py-2"
            >
              <FilePreview file={file} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="ml-auto"
                disabled={disabled}
                aria-label={`Quitar ${file.name}`}
                onClick={() => remove(index)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Miniatura si es imagen; el icono genérico si no lo es. */
function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  // La URL del objeto se crea dentro del efecto, no durante el render, para
  // que su creación y su revocación vivan en el mismo ciclo: así el doble
  // montaje de StrictMode vuelve a crearla en lugar de dejar la vista previa
  // apuntando a una URL ya revocada. Sin revocarla, el archivo se quedaría en
  // memoria mientras dure la pestaña.
  useEffect(() => {
    if (!isImage(file)) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el recurso nace y muere con el efecto; no hay forma de derivarlo del render sin filtrarlo
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [file]);

  if (isImage(file) && url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob local, no pasa por el optimizador
      <img
        src={url}
        alt={file.name}
        data-testid="file-preview-image"
        className="size-10 shrink-0 rounded-md object-cover"
      />
    );
  }

  return (
    <span
      data-testid="file-preview-icon"
      className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
    >
      <FileIcon className="size-4" />
    </span>
  );
}
