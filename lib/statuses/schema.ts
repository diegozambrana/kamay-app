import { z } from "zod";

import { LINE_COLORS, STATUS_FLOWS, STATUS_KINDS } from "@/types";
import type { StatusKind } from "@/types";

/**
 * Validación compartida entre el formulario de V22 y las Server Actions.
 * Vive fuera de `actions/` porque un módulo `"use server"` solo puede
 * exportar funciones asíncronas.
 */
export const statusFlowSchema = z.enum(STATUS_FLOWS);

export const statusFormSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre no puede quedar vacío").max(80),
    color: z.enum(LINE_COLORS),
    kind: z.enum(STATUS_KINDS),
    isQueue: z.boolean(),
  })
  .refine((status) => !status.isQueue || status.kind === "waiting", {
    message: "Solo un estado En espera puede ser columna en cola.",
    path: ["isQueue"],
  });

export type StatusFormValues = z.infer<typeof statusFormSchema>;

export const statusScopeSchema = z.object({
  /** `null` = juego de la organización. */
  businessLineId: z.guid().nullable(),
  flow: statusFlowSchema,
});

/**
 * La regla que V22 valida antes de enviar (la base la garantiza después):
 * todo juego con estados activos necesita al menos un inicial y un final.
 */
export function setIsComplete(kinds: StatusKind[]): boolean {
  if (kinds.length === 0) return true; // juego vacío: se resuelve el de la organización
  return kinds.includes("initial") && kinds.includes("final");
}
