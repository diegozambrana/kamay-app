import Link from "next/link";
import type { ReactNode } from "react";

/** Como el panel (KAM-14): la moneda va en la cabecera, no en cada celda. */
export function money(value: number): string {
  return value.toFixed(2);
}

export function percent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} %`;
}

/**
 * Un informe vacío lo dice; no se deja el hueco en blanco ni se inventan
 * filas. Es la misma decisión que el resto de las pantallas de listado.
 */
export function EmptyReport({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * La nota que acompaña a un informe que **no obedece** a un selector de la
 * cabecera. Toda excepción declarada se escribe en pantalla (design D9):
 * una excepción silenciosa se lee como un fallo y termina en un reporte de
 * error.
 */
export function ScopeNote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs text-muted-foreground" role="note">
      {children}
    </p>
  );
}

/** Toda fila abre su registro; ninguna fila es un callejón sin salida. */
export function RowLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

export function ReportSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-medium">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {children}
    </section>
  );
}
