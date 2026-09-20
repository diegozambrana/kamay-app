/**
 * El enlace de seguimiento que se muestra para copiar y compartir. Mismo
 * patrón que `lib/invitations/invite-url.ts`: el origen sale del `host` de
 * la petición, no del cliente.
 */
export function orderShareUrlFor(host: string, token: string): string {
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}/p/${token}`;
}
