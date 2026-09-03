import { z } from "zod";

import { ITEM_KINDS } from "@/types";

/**
 * Validación compartida entre los formularios de V10, V11 y V13 y las Server
 * Actions. Vive fuera de `actions/` porque un módulo `"use server"` solo puede
 * exportar funciones asíncronas.
 */

const name = z.string().trim().min(1, "El nombre no puede quedar vacío").max(120);

/** Un texto opcional vacío es ausencia de dato, no una cadena vacía. */
const optionalText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((value) =>
    value === undefined || value === null || value === "" ? null : value,
  );

/**
 * Los importes llegan del formulario como texto. Vacío es "no lo sé todavía",
 * que no es lo mismo que cero.
 */
const optionalAmount = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    if (value === undefined || value === "" || value === null) return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .refine((value) => value === null || (!Number.isNaN(value) && value >= 0), {
    message: "Debe ser un número mayor o igual que cero",
  });

export const itemKindSchema = z.enum(ITEM_KINDS);

export const itemFormSchema = z.object({
  name,
  kind: itemKindSchema,
  /** `null` = compartido entre líneas; no es un campo sin llenar. */
  businessLineId: z.guid().nullable(),
  unitId: z.guid().nullable(),
  category: optionalText,
  description: optionalText,
  salePrice: optionalAmount,
  minStock: optionalAmount,
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const itemVariantFormSchema = z.object({
  name: z.string().trim().min(1, "La variante necesita un nombre").max(80),
  salePrice: optionalAmount,
});

export type ItemVariantFormValues = z.infer<typeof itemVariantFormSchema>;

/**
 * Un contacto sin rol no es nadie: no aparecería en ningún buscador. La regla
 * vive por triplicado a propósito — restricción `has_a_role` en la base, este
 * refinamiento compartido, y el aviso del formulario.
 */
export const contactFormSchema = z
  .object({
    name,
    phone: optionalText,
    email: z
      .string()
      .trim()
      .max(200)
      .nullish()
      .transform((value) =>
        value === undefined || value === null || value === "" ? null : value,
      )
      .refine((value) => value === null || z.email().safeParse(value).success, {
        message: "El correo no tiene un formato válido",
      }),
    address: optionalText,
    notes: optionalText,
    isSupplier: z.boolean(),
    isCustomer: z.boolean(),
  })
  .refine((contact) => contact.isSupplier || contact.isCustomer, {
    message: "Un contacto tiene que ser proveedor, cliente o ambos.",
    path: ["isSupplier"],
  });

export type ContactFormValues = z.infer<typeof contactFormSchema>;

/**
 * Creación al vuelo desde un buscador: lo mínimo para poder seleccionarlo.
 *
 * El teléfono es opcional pero se pide en el mismo paso desde KAM-08: al
 * registrar un pedido, el número del cliente es justo el dato que hace falta
 * a continuación, y volver al directorio a completarlo rompe el ritmo del
 * alta. El resto de los datos siguen completándose después.
 */
export const quickContactSchema = z
  .object({
    id: z.guid(),
    name,
    phone: optionalText,
    isSupplier: z.boolean(),
    isCustomer: z.boolean(),
  })
  .refine((contact) => contact.isSupplier || contact.isCustomer, {
    message: "Un contacto tiene que ser proveedor, cliente o ambos.",
    path: ["isSupplier"],
  });

/** La misma regla que la base garantiza después, para avisar antes de enviar. */
export function hasARole(contact: {
  isSupplier: boolean;
  isCustomer: boolean;
}): boolean {
  return contact.isSupplier || contact.isCustomer;
}
