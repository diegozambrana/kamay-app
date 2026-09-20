"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  discardOrderRequest,
  regenerateOrderRequestLink,
} from "@/actions/order-requests";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MainContainer } from "@/components/layout/main-container";
import { formatDateTime } from "@/lib/format/datetime";
import { deriveOrderRequestStatus, isOrderRequestExpired } from "@/lib/order-requests/status";
import { orderRequestWhatsAppLink } from "@/lib/order-requests/whatsapp";
import type { QuarantineImage } from "@/services/order-requests/order-request-service";
import type { OrderRequest } from "@/types";

const STATUS_LABELS = {
  waiting: "Esperando al cliente",
  received: "Recibida",
  accepted: "Aceptada",
  discarded: "Descartada",
} as const;

/**
 * KAM-28 · El detalle de una solicitud: sus imágenes, y aceptar o descartar.
 * Aceptar navega al alta de pedido existente prellenada (spec
 * `order-requests` — Requirement: Aceptar reutiliza el alta de pedido
 * existente y traslada las imágenes); la copia de las imágenes y el vínculo
 * final los hace `acceptOrderRequest` cuando ese alta guarda con éxito.
 */
export function OrderRequestDetail({
  request,
  images,
  organizationName,
  timezone,
}: {
  request: OrderRequest;
  images: QuarantineImage[];
  organizationName: string;
  timezone: string;
}) {
  const router = useRouter();
  const status = deriveOrderRequestStatus(request);
  const expired = status === "waiting" && isOrderRequestExpired(request.expiresAt);

  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateOrderRequestLink(request.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setUrl(result.url);
    });
  }

  function discard() {
    setError(null);
    startTransition(async () => {
      const result = await discardOrderRequest(request.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/orders/requests");
    });
  }

  function accept() {
    router.push(`/orders/new?request=${request.id}`);
  }

  const phone = request.declaredPhone ?? request.prefilledPhone;
  const whatsappLink = url ? orderRequestWhatsAppLink(phone, organizationName, url) : null;

  return (
    <MainContainer
      title={request.declaredName ?? request.prefilledName}
      breadcrumbs={[
        { label: "Pedidos", href: "/orders" },
        { label: "Solicitudes", href: "/orders/requests" },
        { label: request.declaredName ?? request.prefilledName },
      ]}
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Datos</CardTitle>
            <Badge variant={status === "discarded" ? "outline" : "secondary"}>
              {expired ? "Vencida" : STATUS_LABELS[status]}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p>{request.declaredName ?? request.prefilledName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Teléfono</p>
              <p>{phone}</p>
            </div>
            {request.declaredNote && (
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Nota del cliente</p>
                <p>{request.declaredNote}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Generada</p>
              <p>{formatDateTime(request.createdAt, timezone)}</p>
            </div>
            {request.orderId && (
              <div>
                <p className="text-sm text-muted-foreground">Pedido aceptado</p>
                <Link href={`/orders/${request.orderId}`} className="underline">
                  Ver pedido
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {images.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Imágenes de referencia</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {images.map((image) =>
                image.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={image.path}
                    src={image.signedUrl}
                    alt={image.name}
                    className="h-32 w-32 rounded-md border object-cover"
                  />
                ) : null,
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        {url && (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div
                role="status"
                data-testid="request-url"
                className="rounded-lg border bg-muted/40 p-3 text-sm"
              >
                <code className="block break-all text-xs">{url}</code>
              </div>
              {whatsappLink && (
                <Button asChild className="w-fit">
                  <a href={whatsappLink} target="_blank" rel="noreferrer">
                    Enviar por WhatsApp
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          {status === "waiting" && (
            <Button type="button" variant="outline" disabled={pending} onClick={regenerate}>
              {pending ? "Regenerando…" : "Regenerar enlace"}
            </Button>
          )}
          {status === "received" && (
            <Button type="button" disabled={pending} onClick={accept}>
              Aceptar
            </Button>
          )}
          {(status === "waiting" || status === "received") && (
            <Button type="button" variant="destructive" disabled={pending} onClick={discard}>
              Descartar
            </Button>
          )}
        </div>
      </div>
    </MainContainer>
  );
}
