/**
 * KAM-28 · El estado de una solicitud de pedido, siempre derivado
 * (convención nº 4), nunca almacenado.
 *
 * Los cuatro valores son los del delta spec `order-requests`: esperando al
 * cliente → recibida → aceptada | descartada. `archived_at` manda sobre
 * `order_id`, que manda sobre `submitted_at`: una solicitud descartada lo
 * sigue siendo aunque alguna vez se hubiera aceptado, y una aceptada no
 * vuelve a leerse como «solo recibida».
 */
export type OrderRequestStatus = "waiting" | "received" | "accepted" | "discarded";

export type OrderRequestStatusInput = {
  submittedAt: string | null;
  orderId: string | null;
  archivedAt: string | null;
};

export function deriveOrderRequestStatus(
  request: OrderRequestStatusInput,
): OrderRequestStatus {
  if (request.archivedAt) return "discarded";
  if (request.orderId) return "accepted";
  if (request.submittedAt) return "received";
  return "waiting";
}

/**
 * Si venció, por separado del estado: una solicitud vencida sigue siendo
 * «esperando al cliente» —puede regenerarse— hasta que alguien la descarte o
 * la acepte tras regenerar el enlace. No es un quinto estado, es una
 * propiedad de la misma marca `expires_at` que ya alimenta la resolución del
 * token.
 */
export function isOrderRequestExpired(
  expiresAt: string,
  now: Date = new Date(),
): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
