import { Badge } from "@/components/ui/badge";
import { paymentStatus } from "@/lib/payments/balance";
import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@/types";

/**
 * Los nombres visibles del estado de pago. Viven aquí, en español, mientras
 * la base habla en inglés (convención nº 8), y son lo único configurable de
 * este componente: el estado en sí se deriva y no se elige.
 */
const LABELS: Record<PaymentStatus, string> = {
  pending: "Sin cobrar",
  partial: "Anticipo",
  paid: "Pagado",
  overpaid: "Cobrado de más",
};

const STYLES: Record<PaymentStatus, string> = {
  pending: "border-transparent bg-muted text-muted-foreground",
  partial: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  overpaid: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

/**
 * Señal de pago de un documento. Se calcula desde `total` y `paid` con la
 * misma función que usan el detalle y la bandeja de egresos: no hay ningún
 * campo editable detrás, ni aquí ni en la base (convención nº 4).
 */
export function PaymentStatusBadge({
  total,
  paid,
  className,
}: {
  total: number;
  paid: number;
  className?: string;
}) {
  const status = paymentStatus(total, paid);

  return (
    <Badge
      variant="outline"
      data-testid="payment-status"
      data-status={status}
      className={cn(STYLES[status], className)}
    >
      {LABELS[status]}
    </Badge>
  );
}

export { LABELS as PAYMENT_STATUS_LABELS };
