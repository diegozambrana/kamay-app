/** Barra inferior móvil. La navegación llega con cada feature. */
export function MobileNav() {
  return (
    <nav
      data-testid="bottom-bar"
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t bg-background md:hidden"
    >
      {/* Navegación vacía: cada feature añade sus entradas. */}
    </nav>
  );
}
