import { z } from "zod";

/**
 * KAM-28 · Validación compartida del formulario público en `/r/<token>` y de
 * la Server Action que lo recibe. Vive fuera de `actions/` por la misma razón
 * que `lib/catalog/schema.ts`: un módulo `"use server"` solo exporta
 * funciones asíncronas.
 *
 * Nombre y teléfono son obligatorios (criterio de aceptación 3: «un mensaje
 * claro que señala el campo»); la nota es la única captura libre y opcional.
 * Sin productos, sin cantidades, sin precios — el formulario público no los
 * ofrece y este esquema no los admite.
 */
export const publicOrderRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe tu nombre")
    .max(120, "El nombre es demasiado largo"),
  phone: z
    .string()
    .trim()
    .min(1, "Escribe tu teléfono")
    .max(30, "El teléfono es demasiado largo"),
  note: z
    .string()
    .trim()
    .max(2000, "La nota es demasiado larga")
    .nullish()
    .transform((value) => (value === undefined || value === null || value === "" ? null : value)),
});

export type PublicOrderRequestInput = z.infer<typeof publicOrderRequestSchema>;

/**
 * Tope de imágenes de referencia por solicitud (KAM-09/KAM-16 usan el mismo
 * patrón de límite por registro). Más bajo que el de un pedido —20— porque
 * son fotos de referencia de un cliente sin cuenta, no el historial de un
 * taller.
 */
export const MAX_IMAGES_PER_REQUEST = 6;
