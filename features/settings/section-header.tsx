/**
 * Título, descripción y —a la derecha— la acción de alta de una sección de
 * configuración. En el celular la acción baja debajo del texto en vez de
 * competir con él por el ancho.
 */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
