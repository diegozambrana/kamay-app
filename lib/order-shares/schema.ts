import { z } from "zod";

/**
 * KAM-32 · Validación del comentario que deja el cliente en `/p/<token>`.
 * Nombre y cuerpo obligatorios — es lo único que pide el criterio 12.
 */
export const publicOrderCommentSchema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(120, "El nombre es demasiado largo"),
  body: z
    .string()
    .trim()
    .min(1, "Escribe tu comentario")
    .max(1000, "El comentario es demasiado largo"),
});

export type PublicOrderCommentInput = z.infer<typeof publicOrderCommentSchema>;
