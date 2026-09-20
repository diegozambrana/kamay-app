/**
 * KAM-28 · El grupo de rutas público de las solicitudes de pedido.
 *
 * Sin cabecera, sin menú, sin barra inferior — igual que `(fair)`, y por el
 * mismo motivo: quien abre `/r/<token>` no tiene sesión ni la va a tener, así
 * que no hay nada del cascarón que montar. `noindex` ya es global
 * (`next.config.ts` — `X-Robots-Tag`); `Referrer-Policy: no-referrer` es
 * propio de este grupo (design D8).
 */
export default function PublicOrderRequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
