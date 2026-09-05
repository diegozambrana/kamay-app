"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { selectBusinessLine } from "@/actions/business-line-context";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { buildSaleEnvelope } from "@/lib/fair/sale-envelope";
import { snapshotAgeLabel } from "@/lib/fair/snapshot";
import { ALL_LINES, type ActiveLine, type BusinessLine, type PaymentMethod, type SalesChannel } from "@/types";
import type { FairProduct } from "@/services/fair/fair-sale-service";
import { useUserStore } from "@/stores/user-store";

import { CartBar } from "./cart-bar";
import { useCartStore, useCartTotal, useCartUnits } from "./cart-store";
import { CheckoutSheet } from "./checkout-sheet";
import { ExitFairMode } from "./exit-fair-mode";
import { FairStart } from "./fair-start";
import { useFairSessionStore } from "./fair-session-store";
import { ProductGrid } from "./product-grid";
import { captureSale } from "./sync/capture-sale";
import { PendingSalesIndicator } from "./sync/pending-sales-indicator";

/**
 * V6 · Venta rápida. La pantalla que decide si el sistema se usa.
 *
 * El recorrido mínimo es de cuatro interacciones: producto, producto,
 * *Cobrar*, *Confirmar*. Todo lo demás de esta pantalla existe para no
 * estorbarlo.
 */
export function FairScreen({
  organizationId,
  lines,
  activeLine,
  channels,
  products,
}: {
  organizationId: string;
  lines: BusinessLine[];
  activeLine: ActiveLine;
  channels: SalesChannel[];
  products: FairProduct[];
}) {
  const userId = useUserStore((state) => state.user?.id) ?? "";
  const { isOnline, browserOnline, reportSendResult } = useOnlineStatus();

  const session = useFairSessionStore();
  const cart = useCartStore();
  const total = useCartTotal();
  const units = useCartUnits();

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      });
      return;
    }

    void session.restore(organizationId, needsLine ? null : activeLine);
    // Solo al montar y cuando cambia la conectividad o la línea: reejecutarlo
    // en cada render volvería a capturar en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, activeLine, needsLine, browserOnline]);

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

          void session.start({ organizationId, businessLineId, salesChannelId, products });
        }}
      />
    );
  }

  /**
   * Confirmar: encola y **vuelve a la cuadrícula sin esperar al servidor**.
   *
   * El orden importa. Se vacía el carrito y se cierra la hoja ANTES de
   * esperar a `captureSale`, para que la vuelta no dependa de nada remoto
   * (criterio 3, decisión 6). Lo que venga después solo puede añadir un aviso.
   */
  async function confirm(amount: number, method: PaymentMethod) {
    const lines = cart.lines;
    if (lines.length === 0) return;

    const sale = buildSaleEnvelope({
      organizationId,
      businessLineId: session.businessLineId!,
      salesChannelId: session.salesChannelId,
      contactId: null,
      lines,
      amount,
      method,
      // Identificadores de cliente (convención nº 9): reenviar este sobre no
      // puede crear una venta distinta.
      saleId: crypto.randomUUID(),
      paymentId: crypto.randomUUID(),
      // La hora real del hecho, fijada ahora aunque se sincronice esta noche.
      occurredAt: new Date().toISOString(),
    });

    cart.empty();
    setCheckoutOpen(false);
    setError(null);

    const result = await captureSale(sale, userId, { isOnline: () => isOnline });

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
        products={session.products}
        ageLabel={ageLabel}
        onPick={(product) =>
          cart.add(
            { id: product.id, name: product.name, salePrice: product.salePrice },
            crypto.randomUUID(),
          )
        }
      />

      <CartBar
        lines={cart.lines}
        units={units}
        total={total}
        onRemove={cart.remove}
        onCheckout={() => setCheckoutOpen(true)}
      />

      <CheckoutSheet
        open={checkoutOpen}
        total={total}
        onOpenChange={setCheckoutOpen}
        onConfirm={(amount, method) => void confirm(amount, method)}
      />
    </>
  );
}
