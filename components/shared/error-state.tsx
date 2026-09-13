"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description?: string;
  /** Vuelve a pedir los datos: el `retry()` del límite de error de Next. */
  onRetry: () => void;
  className?: string;
};

/**
 * Error al cargar: explicación en lenguaje humano y reintentar (mapa de
 * navegación §12, spec `view-states`).
 *
 * El componente **no recibe el error**, a propósito. Un mensaje de excepción,
 * un código o un identificador no le dicen nada a quien vende en una feria, y
 * pueden filtrar detalles internos; así que no hay manera de pintarlos aquí
 * aunque alguien quiera. El error se registra aparte, donde sí sirve.
 *
 * Reintentar corre en una transición: mientras Next vuelve a pedir el
 * segmento, el botón queda deshabilitado y dice lo que está pasando, en lugar
 * de admitir diez toques impacientes.
 */
export function ErrorState({
  title = "No se pudo cargar esta sección",
  description = "Puede ser la conexión o un fallo momentáneo. Vuelve a intentarlo en unos segundos.",
  onRetry,
  className,
}: ErrorStateProps) {
  const [retrying, startRetry] = useTransition();

  return (
    <Empty
      data-testid="error-state"
      role="alert"
      className={cn("border border-dashed border-destructive/40", className)}
    >
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          type="button"
          onClick={() => startRetry(onRetry)}
          disabled={retrying}
        >
          {retrying ? "Reintentando…" : "Reintentar"}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
