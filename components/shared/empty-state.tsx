import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  /** Qué no hay todavía, en una frase: «Aún no hay pedidos en esta línea». */
  title: React.ReactNode;
  description?: string;
  /** La acción que corresponde a esta vista: crear el primero. */
  action?: React.ReactNode;
  className?: string;
  /**
   * `empty-state` es el vacío de la vista entera. Un vacío de sección —una
   * columna, un grupo— lleva el suyo, para que nadie los confunda.
   */
  testId?: string;
};

/**
 * Vacío inicial: la vista no tiene ningún registro y no hay filtro aplicado
 * (mapa de navegación §12, spec `view-states`).
 *
 * Mensaje breve y neutro más la acción que corresponde, y **nada más**: el
 * mapa prohíbe expresamente ilustraciones y textos motivacionales, así que el
 * componente no admite icono ni imagen. No es un olvido: es la regla.
 *
 * Distinto de `FilteredEmptyState`: aquí no hay filtros que quitar, y ofrecer
 * «Quitar filtros» en una organización vacía sería mentir sobre la causa.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
  testId = "empty-state",
}: EmptyStateProps) {
  return (
    <Empty
      data-testid={testId}
      className={cn("border border-dashed", className)}
    >
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
