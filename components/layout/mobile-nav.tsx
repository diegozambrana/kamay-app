"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  barLabelOf,
  bottomBarEntriesFor,
  isNavEntryActive,
  moreEntriesFor,
} from "@/components/layout/nav-entries";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";

/**
 * Rutas de captura: formularios que en el celular son pantalla completa
 * (mapa de navegación §2.3). Ahí la barra inferior estorba —tapa las
 * acciones de guardar y ofrece salidas que se saltarían la confirmación de
 * descarte—, así que no se rinde.
 *
 * El botón *+ Registrar* usa esta misma lista: dos criterios distintos de
 * "esto es una pantalla de captura" acabarían discrepando (design D8).
 */
const CAPTURE_ROUTES = [
  /^\/orders\/new$/,
  /^\/orders\/[^/]+\/edit$/,
  /^\/expenses\/purchases\/new$/,
  /^\/expenses\/costs\/new$/,
];

export function isCaptureRoute(pathname: string): boolean {
  return CAPTURE_ROUTES.some((route) => route.test(pathname));
}

/**
 * Barra inferior móvil: cuatro ranuras —Inicio, Pedidos, Tareas y Más—,
 * como manda el mapa §4.2.
 *
 * Antes rendía las siete entradas del menú lateral y en 390 px los rótulos se
 * cortaban. Ahora tres ranuras son navegación y la cuarta abre el panel con
 * el resto de secciones; las tres superficies salen de `nav-entries.ts`, que
 * sigue siendo la única fuente (design D2).
 */
export function MobileNav() {
  const role = useUserStore((state) => state.membership?.role);
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  if (isCaptureRoute(pathname)) return null;

  const entries = bottomBarEntriesFor(role);
  const more = moreEntriesFor(role);

  const slotClass =
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-muted-foreground";

  return (
    <>
      <nav
        data-testid="bottom-bar"
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t bg-background md:hidden"
      >
        {entries.map((entry) => {
          const Icon = entry.icon;
          const active = isNavEntryActive(entry.href, pathname);

          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? "page" : undefined}
              className={cn(slotClass, active && "text-foreground")}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="w-full truncate text-center text-[0.625rem] leading-none">
                {barLabelOf(entry)}
              </span>
            </Link>
          );
        })}

        {/* La cuarta ranura no es navegación sino el disparador de su panel,
            así que es un `button`: anuncia que despliega y no que navega. */}
        <button
          type="button"
          data-testid="bottom-bar-more"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
          className={cn(slotClass, moreOpen && "text-foreground")}
        >
          <MenuIcon className="size-5 shrink-0" aria-hidden />
          <span className="w-full truncate text-center text-[0.625rem] leading-none">
            Más
          </span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          data-testid="more-panel"
          className="md:hidden"
        >
          <SheetHeader>
            <SheetTitle>Más</SheetTitle>
          </SheetHeader>

          <nav aria-label="Más secciones" className="grid gap-1 px-4 pb-6">
            {more.map((entry) => {
              const Icon = entry.icon;
              const active = isNavEntryActive(entry.href, pathname);

              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  // Cerrar al elegir se hace aquí y no en un efecto sobre la
                  // ruta: un `setState` dentro de un efecto encadena renders
                  // (regla `react-hooks/set-state-in-effect`).
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm",
                    active ? "bg-accent text-accent-foreground" : "text-foreground",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {entry.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
