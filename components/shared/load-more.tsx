"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/pagination";

type LoadMoreProps = {
  /** El parámetro de la dirección que lleva el límite: `limit`, `closed`… */
  param?: string;
  /** El límite con el que se pidió lo que hoy se ve. */
  limit: number;
  /** Qué se está mostrando, para decirlo: «los 50 pedidos cerrados más recientes». */
  shownLabel: string;
  pageSize?: number;
};

/**
 * «Mostrar más» de toda lista acotada (KAM-23, spec `performance-budget`).
 *
 * Amplía la ventana en una vuelta cambiando el límite de la dirección: es una
 * navegación dentro de la aplicación, así que la vista no se recarga y lo
 * que ya estaba en pantalla sigue ahí mientras llega el resto. Mientras
 * tanto, el botón lo dice.
 */
export function LoadMore({ param = "limit", limit, shownLabel, pageSize = PAGE_SIZE }: LoadMoreProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [loading, startLoading] = useTransition();

  function more() {
    const next = new URLSearchParams(params.toString());
    next.set(param, String(limit + pageSize));
    startLoading(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div
      data-testid="load-more"
      className="flex flex-wrap items-center justify-center gap-3 py-2 text-sm text-muted-foreground"
    >
      <span>Se muestran {shownLabel}.</span>
      <Button type="button" variant="outline" size="sm" onClick={more} disabled={loading}>
        {loading ? "Cargando…" : "Mostrar más"}
      </Button>
    </div>
  );
}
