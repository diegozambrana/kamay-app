"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/monitoring/report-error";

type State =
  | { kind: "idle" }
  | { kind: "preparing"; bytes: number }
  | { kind: "done"; filename: string }
  | { kind: "failed" };

const DOWNLOAD_URL = "/settings/export/download";

function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** `attachment; filename="kamay-exportacion-….zip"` → el nombre. */
function filenameFrom(disposition: string | null): string {
  return disposition?.match(/filename="([^"]+)"/)?.[1] ?? "kamay-exportacion.zip";
}

/**
 * La descarga de la exportación completa, con su progreso (KAM-23, spec
 * `data-export` → *The export is available at any moment and reports its
 * progress*).
 *
 * Un enlace de descarga suelto no sabe si el archivo se está armando ni si
 * falló: el navegador enseña su propia barra, o nada. Aquí se pide el archivo
 * con `fetch`, se cuenta lo que va llegando para decir que está en curso, y
 * al terminar se entrega; si algo falla, se explica en lenguaje humano y se
 * ofrece reintentar.
 */
export function ExportSection({ isOwner }: { isOwner: boolean }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function download() {
    setState({ kind: "preparing", bytes: 0 });
    try {
      const response = await fetch(DOWNLOAD_URL, { cache: "no-store" });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        bytes += value.length;
        setState({ kind: "preparing", bytes });
      }

      const filename = filenameFrom(response.headers.get("content-disposition"));
      const url = URL.createObjectURL(new Blob(chunks as BlobPart[], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      setState({ kind: "done", filename });
    } catch (error) {
      reportError(error, { boundary: "exportación completa" });
      setState({ kind: "failed" });
    }
  }

  const preparing = state.kind === "preparing";

  return (
    <div className="flex flex-col gap-4" data-testid="export-section">
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Un archivo comprimido con un CSV por tabla, que se abre en cualquier hoja de cálculo.</li>
        <li>Los importes salen como números, sin símbolo de moneda, para que se puedan sumar.</li>
        {isOwner ? (
          <li>
            Incluye la bitácora completa, también el detalle antiguo que la retención ya guardó
            aparte.
          </li>
        ) : (
          <li>Sale lo que puedes ver con tu rol: los egresos, los activos y la bitácora no.</li>
        )}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={download} disabled={preparing} data-testid="export-download">
          <DownloadIcon className="size-4" aria-hidden />
          {preparing ? "Preparando…" : "Descargar exportación"}
        </Button>

        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {state.kind === "preparing" &&
            (state.bytes > 0
              ? `Armando el archivo… ${sizeLabel(state.bytes)} hasta ahora.`
              : "Armando el archivo…")}
          {state.kind === "done" && `Listo: ${state.filename}`}
        </p>
      </div>

      {state.kind === "failed" && (
        <div role="alert" data-testid="export-failed" className="rounded-md border border-destructive/40 p-3 text-sm">
          <p className="font-medium">No se pudo preparar la exportación.</p>
          <p className="mt-1 text-muted-foreground">
            Puede ser la conexión o un fallo momentáneo. Tus datos no cambiaron.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={download}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
