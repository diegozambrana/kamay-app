"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { selectBusinessLine } from "@/actions/business-line-context";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { buildSaleEnvelope, buildSaleEnvelopes } from "@/lib/fair/sale-envelope";
import { snapshotAgeLabel } from "@/lib/fair/snapshot";
import { ALL_LINES, type ActiveLine, type BusinessLine, type PaymentMethod, type SalesChannel } from "@/types";
import type { FairProduct } from "@/services/fair/fair-sale-service";
import { useUserStore } from "@/stores/user-store";

import { CartBar } from "./cart-bar";
import { CartDrawer } from "./cart-drawer";
import { useCartStore, useCartTotal, useCartUnits } from "./cart-store";
import { ExitFairMode } from "./exit-fair-mode";
import { FairStart } from "./fair-start";
import { useFairSessionStore } from "./fair-session-store";
import { FairToast, type FairToastMessage } from "./fair-toast";
import { ProductGrid } from "./product-grid";
import { captureSale, captureSales } from "./sync/capture-sale";
import { PendingSalesIndicator } from "./sync/pending-sales-indicator";
import { useFairPhotoUrls } from "./use-fair-photo-urls";

const SALE_REGISTERED = "Venta registrada";
const SALE_QUEUED = "Venta guardada. Se enviará al recuperar la señal.";

/**
 * V6 · Venta rápida. La pantalla que decide si el sistema se usa.
 *
 * El recorrido mínimo es de cuatro interacciones: *Agregar*, *Agregar*,
 * *Ver carrito*, *Registrar pedido*. Todo lo demás de esta pantalla existe
 * para no estorbarlo.
 */
export function FairScreen({
  organizationId,
  lines,
  activeLine,
  channels,
  products,
  allLines = false,
}: {
  organizationId: string;
  lines: BusinessLine[];
  activeLine: ActiveLine;
  channels: SalesChannel[];
  products: FairProduct[];
  /**
   * «Venta rápida con todas las líneas» (`fair-all-lines`): la cuadrícula
   * trae productos de todas las líneas y cada uno se registra en la suya.
   */
  allLines?: boolean;
}) {
  const userId = useUserStore((state) => state.user?.id) ?? "";
  const { isOnline, browserOnline, reportSendResult } = useOnlineStatus();

  const session = useFairSessionStore();
  const cart = useCartStore();
  const total = useCartTotal();
  const units = useCartUnits();

  const [cartOpen, setCartOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<FairToastMessage | null>(null);
  // Cambia en cada venta: remonta la cuadrícula y devuelve todos sus
  // selectores de cantidad a 1 («la vista queda limpia»).
  const [saleCount, setSaleCount] = useState(0);
  const [switchingLine, startLineSwitch] = useTransition();
  // El canal elegido en el paso de inicio, guardado mientras el servidor
  // vuelve con el catálogo de la línea nueva.
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null);

  const needsLine = activeLine === ALL_LINES;

  // Al montar se intenta rescatar la feria capturada. Con red y línea resuelta
  // el servidor ya trajo el catálogo, así que se captura de nuevo: entrar con
  // señal siempre renueva (decisión 12).
  useEffect(() => {
    if (!needsLine && browserOnline && products.length > 0) {
      void session.start({
        organizationId,
        businessLineId: activeLine,
        salesChannelId: pendingChannelId ?? channels[0]?.id ?? null,
        products,
        allLines,
      });
      return;
    }

    void session.restore(organizationId, needsLine ? null : activeLine);
    // Solo al montar y cuando cambia la conectividad o la línea: reejecutarlo
    // en cada render volvería a capturar en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, activeLine, needsLine, browserOnline]);

  const photoUrls = useFairPhotoUrls(session.products, session.photos);

  const ageLabel = useMemo(
    () => (session.capturedAt ? snapshotAgeLabel({ capturedAt: session.capturedAt }) : null),
    [session.capturedAt],
  );

  if (session.loading || switchingLine) return null;

  // Sin sesión de feria resuelta: el paso de inicio. Sin red y sin captura
  // previa, explica qué hacer en vez de enseñar una cuadrícula vacía.
  if (!session.businessLineId) {
    return (
      <FairStart
        lines={lines}
        channels={channels}
        needsLine={needsLine}
        allLines={allLines}
        offlineWithoutSnapshot={!browserOnline}
        onStart={(businessLineId, salesChannelId) => {
          // Elegir línea aquí tiene que traer SU catálogo. El servidor trajo
          // el de la línea activa anterior —o ninguno, con «Todas»—, así que
          // fijar la línea y dejar que el Server Component vuelva a
          // renderizar es lo único que produce la cuadrícula correcta.
          //
          // Se usa la misma acción que el selector de línea del resto de la
          // aplicación: la cookie es `httpOnly` y ese es su único punto de
          // escritura. El canal se guarda al volver, con el catálogo ya
          // resuelto por el efecto de arriba.
          if (businessLineId !== activeLine) {
            setPendingChannelId(salesChannelId);
            startLineSwitch(() => void selectBusinessLine(businessLineId));
            return;
          }

          void session.start({
            organizationId,
            businessLineId,
            salesChannelId,
            products,
            allLines,
          });
        }}
      />
    );
  }

  /**
   * Registrar: encola y **vuelve a la cuadrícula sin esperar al servidor**.
   *
   * El orden importa. Se vacía el carrito, se cierra el panel, se limpian los
   * selectores y se avisa ANTES de esperar a `captureSale`, para que la
   * vuelta no dependa de nada remoto (criterio 3, decisión 6). Lo que venga
   * después solo puede cambiar el aviso.
   */
  async function register(amount: number, method: PaymentMethod) {
    const lines = cart.lines;
    if (lines.length === 0) return;

    const shared = {
      organizationId,
      salesChannelId: session.salesChannelId,
      contactId: null,
      lines,
      amount,
      method,
      // La hora real del hecho, fijada ahora aunque se sincronice esta noche.
      occurredAt: new Date().toISOString(),
    };

    // Con «Venta rápida con todas las líneas», una venta por línea de negocio
    // (`fair-all-lines`); sin ella, todo a la línea de la feria, como siempre.
    // Identificadores de cliente (convención nº 9): reenviar un sobre no puede
    // crear una venta distinta.
    const sales = session.allLines
      ? buildSaleEnvelopes({
          ...shared,
          fairLineId: session.businessLineId!,
          newId: () => crypto.randomUUID(),
        })
      : [
          buildSaleEnvelope({
            ...shared,
            businessLineId: session.businessLineId!,
            saleId: crypto.randomUUID(),
            paymentId: crypto.randomUUID(),
          }),
        ];

    cart.empty();
    setCartOpen(false);
    setSaleCount((count) => count + 1);
    setError(null);
    // El aviso depende de lo que dice el navegador al registrar, no del
    // resultado de `captureSale`: en la feria su plazo es cero
    // (`FAIR_FLUSH_DEADLINE_MS`), así que con red devuelve «en cola» casi
    // siempre y la venta sale un instante después. Lo que sí queda pendiente
    // lo cuenta el indicador.
    setToast({ id: Date.now(), text: browserOnline ? SALE_REGISTERED : SALE_QUEUED });

    // Varias ventas viajan juntas en un solo sobre: todas o ninguna.
    const result =
      sales.length === 1
        ? await captureSale(sales[0], userId, { isOnline: () => isOnline })
        : await captureSales(sales, userId, { isOnline: () => isOnline });

    // Lo que acaba de pasar es mejor evidencia de conectividad que
    // `navigator.onLine`, que en una WiFi sin salida sigue diciendo que sí.
    reportSendResult(result.status !== "queued");

    // Un rechazo permanente no puede perderse en silencio, pero tampoco puede
    // interrumpir la venta siguiente: se avisa y la cola lo retiene.
    if (result.status === "failed") setError(result.message);
  }

  return (
    <>
      {/* Extremos opuestos: la salida arriba a la izquierda, los controles de
          venta abajo a la derecha (decisión 7). */}
      <div className="flex shrink-0 items-center justify-between px-2 py-1">
        <ExitFairMode />
        <PendingSalesIndicator />
      </div>

      {error ? (
        <p role="alert" className="px-3 pb-1 text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <ProductGrid
        key={saleCount}
        products={session.products}
        photoUrls={photoUrls}
        ageLabel={ageLabel}
        showLine={session.allLines}
        onAdd={(product, quantity) =>
          cart.add(
            {
              id: product.id,
              name: product.name,
              salePrice: product.salePrice,
              businessLineId: product.businessLineId,
            },
            crypto.randomUUID(),
            quantity,
          )
        }
      />

      <CartBar units={units} total={total} onOpen={() => setCartOpen(true)} />

      <CartDrawer
        open={cartOpen}
        lines={cart.lines}
        units={units}
        total={total}
        onOpenChange={setCartOpen}
        onSetQuantity={cart.setQuantity}
        onRemove={cart.remove}
        onRegister={(amount, method) => void register(amount, method)}
      />

      <FairToast message={toast} />
    </>
  );
}
