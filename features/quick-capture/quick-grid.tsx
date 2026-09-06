"use client";

import Link from "next/link";

import { destinationsFor, isAvailable } from "@/lib/quick-capture/destinations";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";

/**
 * V16 · La retícula de registro rápido.
 *
 * Seis ranuras en dos columnas desde el primer día, aunque dos destinos aún
 * no existan: si la retícula creciera de cuatro a seis en dos tareas, habría
 * que volver a verificar el alcance del pulgar en cada una (design D7).
 *
 * Filtrada por rol: lo que un rol no puede usar no aparece —ocultar, no
 * deshabilitar (mapa §4.4)—. Deshabilitar sí es lo correcto cuando la razón
 * es que el producto todavía no lo tiene, y eso lo dice `availableFrom`.
 */
export function QuickGrid() {
  const role = useUserStore((state) => state.membership?.role);
  const destinations = destinationsFor(role);

  const tileClass =
    "flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center";

  return (
    <div data-testid="quick-grid" className="grid grid-cols-2 gap-3">
      {destinations.map((destination) => {
        const Icon = destination.icon;

        if (!isAvailable(destination)) {
          return (
            <button
              key={destination.key}
              type="button"
              disabled
              aria-disabled
              data-testid={`quick-destination-${destination.key}`}
              className={cn(tileClass, "border-dashed text-muted-foreground")}
            >
              <Icon className="size-7 shrink-0" aria-hidden />
              <span className="text-sm font-medium">{destination.label}</span>
              <span className="text-xs">{destination.availableFrom}</span>
            </button>
          );
        }

        return (
          <Link
            key={destination.key}
            href={destination.href as string}
            data-testid={`quick-destination-${destination.key}`}
            className={cn(tileClass, "bg-card hover:bg-accent")}
          >
            <Icon className="size-7 shrink-0" aria-hidden />
            <span className="text-sm font-medium">{destination.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
