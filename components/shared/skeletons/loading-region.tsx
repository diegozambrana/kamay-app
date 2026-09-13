type LoadingRegionProps = {
  /** Lo que se anuncia al lector de pantalla mientras llega el contenido. */
  label?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Envoltorio de todo esqueleto: una región viva que anuncia la carga una sola
 * vez, en lugar de que cada bloque gris sea un elemento sin sentido para quien
 * no lo ve. Los bloques de dentro son decorativos y se ocultan al lector.
 */
export function LoadingRegion({
  label = "Cargando…",
  className,
  children,
}: LoadingRegionProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="loading-skeleton"
      className={className}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}
