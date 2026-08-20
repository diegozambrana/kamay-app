import type { StatusKind } from "@/types";

/** Texto visible del tipo declarado (el código compara por `kind`, nunca por nombre). */
export const STATUS_KIND_LABELS: Record<StatusKind, string> = {
  initial: "Inicial",
  in_progress: "En curso",
  waiting: "En espera",
  final: "Final",
  cancelled: "Cancelado",
};
