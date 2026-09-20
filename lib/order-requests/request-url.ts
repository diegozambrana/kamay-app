/**
 * El enlace de la solicitud que se muestra para copiar y enviar. Mismo
 * patrón que `lib/invitations/invite-url.ts` y `lib/order-shares/share-url.ts`
 * (KAM-32): el origen sale del `host` de la petición, no del cliente.
 */
export function orderRequestUrlFor(host: string, token: string): string {
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}/r/${token}`;
}
