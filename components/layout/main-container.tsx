import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

type MainContainerProps = {
  /**
   * `ReactNode` y no `string`: el detalle de pedido compone el número con sus
   * insignias de línea y de retraso.
   */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Zona de acciones, alineada a la derecha del título. */
  action?: React.ReactNode;
  loading?: boolean;
  /** Sin datos que mostrar todavía. `error` manda sobre esto. */
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  error?: string;
  children: React.ReactNode;
};

/**
 * Contenedor de toda vista: encabezado uniforme y padding.
 *
 * Antes vivía en el layout y solo ponía padding, de modo que cada pantalla
 * repetía su propio `<h1>` a mano —y no siempre igual: Pedidos usaba `text-xl`
 * y además doblaba el padding con un `p-4` propio—. Ahora el encabezado es
 * parte del contenedor y las pantallas solo declaran qué dice.
 *
 * El `pb-20` deja sitio a la barra inferior de móvil, que sigue existiendo.
 */
export function MainContainer({
  title,
  description,
  action,
  loading = false,
  isEmpty = false,
  emptyTitle = "Todavía no hay nada aquí",
  emptyDescription,
  error,
  children,
}: MainContainerProps) {
  return (
    <main className="min-w-0 flex-1 p-4 pb-20 md:p-6 md:pb-6">
      {/* El encabezado se rinde también mientras carga: si desapareciera, la
          pantalla daría un salto al llegar los datos. */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>No se pudo cargar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : isEmpty ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            {emptyDescription && (
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            )}
          </EmptyHeader>
        </Empty>
      ) : (
        children
      )}
    </main>
  );
}
