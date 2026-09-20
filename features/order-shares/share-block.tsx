"use client";

import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";

import {
  generateOrderShare,
  regenerateOrderShare,
  revokeOrderShare,
} from "@/actions/order-shares";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCalendarDate } from "@/lib/format/datetime";
import type { OrderItemWithNames } from "@/services/orders/order-item-service";
import type { OrderWithTotal } from "@/services/orders/order-service";
import type { OrderShare } from "@/types";

import { SharePreview } from "./share-preview";

// La capacidad de compartir del dispositivo nunca cambia en la vida del
// componente: no hay nada a lo que suscribirse. `getServerSnapshot` devuelve
// `false` para que el primer render del cliente coincida con el del
// servidor, y el valor real llega recién al montar — sin el efecto que
// dispara un `setState` (design D8).
function subscribeToNothing() {
  return () => {};
}
function canShareSnapshot() {
  return "share" in navigator;
}
function canShareServerSnapshot() {
  return false;
}

/**
 * KAM-32 · «Compartir con el cliente» — bloque hermano de `PaymentBlock` en
 * el detalle del pedido (design D9).
 *
 * **La URL solo existe en este estado de React** (design D5): el token en
 * claro nunca se guarda, así que ni generar ni regenerar dejan un enlace que
 * se pueda volver a mostrar tras recargar la página. Recargar hace que el
 * bloque vuelva a mostrar «hay un enlace vigente, generado el…», con la
 * opción de regenerarlo — no un enlace que ya no está en memoria.
 */
export function ShareBlock({
  orderId,
  share,
  preview,
}: {
  orderId: string;
  share: OrderShare | null;
  preview: {
    order: OrderWithTotal;
    lines: OrderItemWithNames[];
    statusName: string;
    businessLineName: string;
  };
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const canShare = useSyncExternalStore(
    subscribeToNothing,
    canShareSnapshot,
    canShareServerSnapshot,
  );

  function activate() {
    setError(null);
    startTransition(async () => {
      const result = await generateOrderShare(orderId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setUrl(result.url);
      setCopied(false);
      setPreviewOpen(false);
    });
  }

  function regenerate() {
    if (!share) return;
    setError(null);
    startTransition(async () => {
      const result = await regenerateOrderShare(orderId, share.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setUrl(result.url);
      setCopied(false);
    });
  }

  function revoke() {
    if (!share) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeOrderShare(orderId, share.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setUrl(null);
      setRevokeOpen(false);
    });
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  async function shareLink() {
    if (!url || !canShare) return;
    try {
      await navigator.share({ url, title: `Pedido #${preview.order.code}` });
    } catch {
      // Cancelado por quien comparte: no es un error que mostrar.
    }
  }

  // Sin enlace vigente y sin uno recién generado: ofrecer generar.
  if (!share && !url) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compartir con el cliente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Genera un enlace de solo lectura para que el cliente vea el estado de
            su pedido y pueda comentar.
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}

          <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Generar enlace</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Así lo verá tu cliente</AlertDialogTitle>
                <AlertDialogDescription>
                  Antes de activar el enlace, revisa exactamente lo que va a ver.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <SharePreview
                order={preview.order}
                lines={preview.lines}
                statusName={preview.statusName}
                businessLineName={preview.businessLineName}
              />

              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={pending} onClick={activate}>
                  {pending ? "Activando…" : "Activar y generar enlace"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compartir con el cliente</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        {url ? (
          <>
            <div
              role="status"
              data-testid="share-url"
              className="rounded-lg border bg-muted/40 p-3 text-sm"
            >
              <code className="block break-all text-xs">{url}</code>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                {copied ? "Enlace copiado" : "Copiar enlace"}
              </Button>
              {canShare && (
                <Button type="button" variant="outline" onClick={shareLink}>
                  <Share2Icon aria-hidden />
                  Compartir
                </Button>
              )}
            </div>
          </>
        ) : (
          share && (
            <p className="text-sm text-muted-foreground">
              Hay un enlace vigente, generado el {formatCalendarDate(share.createdAt.slice(0, 10))}.
              Para volver a copiarlo, regenéralo — el anterior deja de servir.
            </p>
          )
        )}

        {share && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button type="button" variant="outline" disabled={pending} onClick={regenerate}>
              {pending ? "Regenerando…" : "Regenerar enlace"}
            </Button>

            <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Revocar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Revocar el enlace?</AlertDialogTitle>
                  <AlertDialogDescription>
                    El cliente deja de poder ver el pedido y sus imágenes de
                    inmediato. Los comentarios que ya dejó no se pierden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction disabled={pending} onClick={revoke}>
                    {pending ? "Revocando…" : "Revocar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
