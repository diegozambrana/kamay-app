/**
 * El enlace de invitación que se muestra para copiar. El origen sale del
 * `host` de la petición, no del cliente: el enlace debe apuntar siempre a
 * esta aplicación. Lo usan *Usuarios y roles* (KAM-04) y el detalle de
 * organización de la plataforma (KAM-26).
 */
export function inviteUrlFor(host: string, token: string): string {
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}/auth/invite/${token}`;
}
