/**
 * La regla de reparto tal como se guarda en `organizations.settings` y tal
 * como llega del formulario de `/settings/general` (KAM-20).
 *
 * La validación de "suman 100" vive aquí y no en la base: los porcentajes son
 * un mapa por línea dentro de un `jsonb`, y una restricción de tabla no puede
 * comprobar que sus claves sean las líneas vivas de la organización sin
 * convertirse en un trigger que hay que mantener a la par del alta de líneas.
 */

import { z } from "zod";

import { ALLOCATION_RULES, DEFAULT_ALLOCATION_RULE } from "@/types";

/** Tolerancia de un céntimo porcentual: 33,33 × 3 no es exactamente 100. */
const EPSILON = 0.01;

export const allocationSettingsSchema = z
  .object({
    rule: z.enum(ALLOCATION_RULES),
    shares: z.record(z.string(), z.number().min(0).max(100)).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.rule !== "manual") return;

    const shares = Object.values(value.shares ?? {});
    if (shares.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["shares"],
        message: "El reparto manual necesita un porcentaje por línea.",
      });
      return;
    }

    const total = shares.reduce((sum, share) => sum + share, 0);
    if (Math.abs(total - 100) > EPSILON) {
      // El mensaje dice cuánto suma y cuánto falta: "no suma 100" obliga a
      // sumar a mano lo que el formulario ya sabe.
      const gap = (100 - total).toFixed(2).replace(/\.00$/, "");
      ctx.addIssue({
        code: "custom",
        path: ["shares"],
        message: `Los porcentajes suman ${total.toFixed(2).replace(/\.00$/, "")} %; faltan ${gap} % para llegar a 100 %.`,
      });
    }
  });

export type AllocationSettingsInput = z.infer<typeof allocationSettingsSchema>;

/**
 * Lee la regla desde el `settings` de la organización. Un `settings` vacío, o
 * con una regla que no reconocemos, devuelve la de por defecto en vez de
 * fallar: una configuración corrupta no debe dejar la pantalla sin informes.
 */
export function readAllocationSettings(
  settings: unknown,
): AllocationSettingsInput {
  const parsed = allocationSettingsSchema.safeParse(
    (settings as { allocation?: unknown } | null)?.allocation,
  );
  return parsed.success ? parsed.data : { rule: DEFAULT_ALLOCATION_RULE };
}
