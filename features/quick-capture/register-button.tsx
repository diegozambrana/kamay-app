"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { isCaptureRoute } from "@/components/layout/mobile-nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { destinationsFor, isAvailable } from "@/lib/quick-capture/destinations";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";

/**
 * *+ Registrar*: el acceso al menú de creación desde cualquier pantalla.
 *
 * Flota sobre la esquina inferior derecha en vez de ocupar una ranura de la
 * barra: un botón central que la partiera en 2+2 dejaría "Tareas" y "Más"
 * fuera del alcance cómodo del pulgar, y una quinta ranura volvería a cortar
 * los rótulos (design D6). Arriba, en la tira de contexto, sigue viviendo el
 * indicador de sincronización: no se pisan.
 *
 * Solo en móvil. El flotante de escritorio es de KAM-14.
 */
export function RegisterButton() {
  const role = useUserStore((state) => state.membership?.role);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // El mismo criterio que la barra inferior: en una pantalla de captura este
  // botón taparía el guardar y ofrecería una salida sin confirmar el descarte.
  if (isCaptureRoute(pathname)) return null;

  const destinations = destinationsFor(role);

  return (
    <>
      <button
        type="button"
        data-testid="register-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Registrar"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
      >
        <PlusIcon className="size-6" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          data-testid="register-menu"
          className="md:hidden"
        >
          <SheetHeader>
            <SheetTitle>Registrar</SheetTitle>
          </SheetHeader>

          <nav aria-label="Qué registrar" className="grid gap-1 px-4 pb-6">
            {destinations.map((destination) => {
              const Icon = destination.icon;
              const rowClass =
                "flex items-center gap-3 rounded-md px-3 py-3 text-sm";

              // Los mismos seis destinos que la retícula, con el mismo estado:
              // ambos salen de `destinations.ts` (design D1).
              return isAvailable(destination) ? (
                <Link
                  key={destination.key}
                  href={destination.href as string}
                  data-testid={`register-destination-${destination.key}`}
                  onClick={() => setOpen(false)}
                  className={cn(rowClass, "text-foreground hover:bg-accent")}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {destination.label}
                </Link>
              ) : (
                <button
                  key={destination.key}
                  type="button"
                  disabled
                  aria-disabled
                  data-testid={`register-destination-${destination.key}`}
                  className={cn(rowClass, "text-muted-foreground")}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span>{destination.label}</span>
                  <span className="ml-auto text-xs">{destination.availableFrom}</span>
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
