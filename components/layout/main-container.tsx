import Link from "next/link";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * Un tramo de las migas. El último es la pantalla actual y no enlaza; los
 * anteriores llevan `href`. `onClick` deja que un formulario con cambios sin
 * guardar intercepte la salida (guardia de descarte).
 */
export type Crumb = {
  label: string;
  href?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

type MainContainerProps = {
  /**
   * `ReactNode` y no `string`: el detalle de pedido compone el número con sus
   * insignias de línea y de retraso.
   */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Zona de acciones, alineada a la derecha del título. */
  action?: React.ReactNode;
  /**
   * Migas de pan de las pantallas de alta, edición y detalle (spec
   * `navigation-breadcrumbs`). Las listas no las declaran.
   */
  breadcrumbs?: Crumb[];
  children: React.ReactNode;
};

/**
 * Contenedor de toda vista: encabezado uniforme y padding.
 *
 * Antes vivía en el layout y solo ponía padding, de modo que cada pantalla
 * repetía su propio `<h1>` a mano —y no siempre igual: Pedidos usaba `text-xl`
 * y además doblaba el padding con un `p-4` propio—. Ahora el encabezado es
 * parte del contenedor y las pantallas solo declaran qué dice.
 *
 * El padding inferior de móvil deja sitio a lo que flota encima: la barra
 * (64 px) y, sobre ella, el botón *+ Registrar* (56 px a 80 px del borde).
 * `pb-36` cubre los 136 px que ocupan entre los dos y deja un margen; con el
 * `pb-20` anterior el flotante tapaba la última fila de toda pantalla.
 * Se resuelve aquí una vez, no pantalla por pantalla (design D6).
 *
 * En escritorio el flotante también existe desde KAM-14 —V2 lo pide entre
 * sus elementos permanentes— y allí no hay barra que despejar: se apoya a
 * 24 px del borde y ocupa 56 px, así que `md:pb-24` basta para que no tape
 * la última fila de ninguna pantalla.
 *
 * Los estados de carga, vacío y error **no** viven aquí. Hasta KAM-23 este
 * contenedor declaraba `loading`, `isEmpty` y `error`, pero ninguna vista los
 * usaba: el «Cargando…» era texto, el vacío no llevaba acción y el error no
 * ofrecía reintentar. Ahora hay una sola implementación de cada estado, en
 * `components/shared/`, y el nivel de ruta la cablea (`loading.tsx`,
 * `error.tsx`).
 */
export function MainContainer({
  title,
  description,
  action,
  breadcrumbs,
  children,
}: MainContainerProps) {
  return (
    <main className="min-w-0 flex-1 p-4 pb-36 md:p-6 md:pb-24">
      {/* El encabezado se rinde también mientras carga (`RouteLoading`) y
          cuando falla (`RouteError`): si desapareciera, la pantalla daría un
          salto al llegar los datos. */}
      {breadcrumbs && breadcrumbs.length > 0 && <Crumbs items={breadcrumbs} />}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      {children}
    </main>
  );
}

/**
 * Una sola línea: el último tramo se recorta con puntos suspensivos y los
 * enlaces conservan su ancho y un área táctil de 44 px, para que en 390 px
 * siempre se pueda volver sin desplazar la página.
 */
function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb className="-mt-2 mb-1 min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className={last ? "min-w-0" : "shrink-0"}>
                {last || !item.href ? (
                  <BreadcrumbPage className="block truncate">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={item.href}
                      onClick={item.onClick}
                      className="inline-flex min-h-11 items-center"
                    >
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
