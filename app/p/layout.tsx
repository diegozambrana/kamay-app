/**
 * KAM-32 · El grupo de rutas público del seguimiento de un pedido.
 *
 * Mismo patrón que `app/r/layout.tsx` (KAM-28): sin cabecera, sin menú, sin
 * barra inferior — quien abre `/p/<token>` no tiene sesión.
 */
export default function PublicOrderShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
