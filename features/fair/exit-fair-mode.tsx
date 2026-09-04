"use client";

import { X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * El **único** control de navegación del modo feria (criterio 1).
 *
 * Va arriba a la izquierda y los controles de venta van abajo a la derecha:
 * separados a propósito, en extremos opuestos de la pantalla. Un control de
 * salida junto a *Cobrar* es una salida accidental por hora de feria.
 *
 * Es `variant="ghost"`: presente y encontrable, pero sin la prominencia de un
 * botón de acción — no compite con lo que de verdad se toca aquí.
 */
export function ExitFairMode() {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      data-testid="fair-exit"
      className="gap-1.5 text-muted-foreground"
    >
      <Link href="/quick">
        <X className="size-4" aria-hidden />
        Salir del modo feria
      </Link>
    </Button>
  );
}
