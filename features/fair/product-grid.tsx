"use client";

import { ImageIcon, Minus, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { FairProduct } from "@/services/fair/fair-sale-service";

/**
 * La cuadrícula de V6: lo primero que se ve al abrir el puesto.
 *
 * Cada tarjeta lleva la foto como miniatura a la izquierda, y a la derecha el
 * nombre, el precio, un selector de cantidad y *Agregar*. **Tocar la tarjeta
 * no hace nada**: con el selector al lado, un toque que agregara por sí solo
 * sumaría unidades por error cada vez que alguien apunta al − o al +
 * (`fair-product-photos-visibility-cart-drawer`).
 *
 * Objetivos de al menos 44 px: se toca de pie, con una mano, con gente
 * esperando. Una columna a 390 px, porque con miniatura, selector y botón dos
 * columnas no caben sin desplazamiento horizontal.
 *
 * La cantidad elegida en cada tarjeta es estado de esta pantalla y de nadie
 * más: `FairScreen` la limpia tras cada venta remontando la cuadrícula.
 */
export function ProductGrid({
  products,
  photoUrls,
  onAdd,
  ageLabel,
  showLine = false,
}: {
  products: readonly FairProduct[];
  /** La imagen de cada producto (`useFairPhotoUrls`); sin entrada, el sustituto. */
  photoUrls: ReadonlyMap<string, string | null>;
  onAdd: (product: FairProduct, quantity: number) => void;
  /** De cuándo es el catálogo mostrado. Siempre a la vista (decisión 12). */
  ageLabel: string | null;
  /**
   * «Venta rápida con todas las líneas» (`fair-all-lines`): con productos de
   * varias líneas, cada tarjeta dice de cuál es.
   */
  showLine?: boolean;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (products.length === 0) {
    // `flex-1` también aquí: sin él la cuadrícula vacía colapsa y la barra de
    // cobro sube al centro de la pantalla, justo donde está el pulgar.
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Esta línea no tiene productos para la venta rápida. Hacen falta productos
          con precio de venta y con «Mostrar en venta rápida» activado en el
          catálogo.
        </p>
      </div>
    );
  }

  const quantityOf = (id: string) => quantities[id] ?? 1;
  const setQuantity = (id: string, quantity: number) =>
    setQuantities((current) => ({ ...current, [id]: Math.max(1, quantity) }));

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {ageLabel ? (
        <p
          data-testid="snapshot-age"
          className="px-3 pt-2 text-center text-xs text-muted-foreground"
        >
          {ageLabel}
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const quantity = quantityOf(product.id);
          return (
            <li key={product.id}>
              <article
                data-testid="fair-product"
                className="flex w-full min-w-0 items-center gap-3 rounded-lg border p-2"
              >
                <FairThumbnail
                  key={photoUrls.get(product.id) ?? "none"}
                  url={photoUrls.get(product.id) ?? null}
                  name={product.name}
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                      {showLine ? (
                        <span
                          data-testid="fair-product-line"
                          className="block truncate text-xs text-muted-foreground"
                        >
                          {product.businessLineName ?? "Compartido"}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-lg font-semibold tabular-nums">
                      {product.salePrice}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11"
                        aria-label={`Disminuir cantidad de ${product.name}`}
                        disabled={quantity <= 1}
                        onClick={() => setQuantity(product.id, quantity - 1)}
                      >
                        <Minus aria-hidden />
                      </Button>
                      <span
                        data-testid="fair-quantity"
                        aria-live="polite"
                        className="w-9 text-center text-base font-semibold tabular-nums"
                      >
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11"
                        aria-label={`Aumentar cantidad de ${product.name}`}
                        onClick={() => setQuantity(product.id, quantity + 1)}
                      >
                        <Plus aria-hidden />
                      </Button>
                    </div>

                    <Button
                      type="button"
                      data-testid="fair-add"
                      className="h-11 px-4"
                      aria-label={`Agregar ${product.name}`}
                      onClick={() => {
                        onAdd(product, quantity);
                        setQuantity(product.id, 1);
                      }}
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * La miniatura, o el sustituto del mismo tamaño cuando no hay foto o no carga
 * (una firma caducada, una copia que no se guardó). Mismo tamaño en los dos
 * casos: una tarjeta que cambia de alto al cargar mueve la de abajo bajo el
 * dedo.
 */
function FairThumbnail({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div
        data-testid="fair-photo-placeholder"
        className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <ImageIcon className="size-5" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada o local (`blob:`): no pasa por el optimizador
    <img
      src={url}
      alt={`Foto de ${name}`}
      decoding="async"
      onError={() => setFailed(true)}
      className="size-16 shrink-0 rounded-md object-cover"
    />
  );
}
