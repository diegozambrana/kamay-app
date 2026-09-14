import { z } from "zod";

/**
 * Validación de las acciones de plataforma (KAM-26). La misma forma que la
 * sección General de Configuración para los datos de una organización, para
 * que un taller creado aquí no pueda quedar con datos que allá se rechazan.
 */

export const DEFAULT_CURRENCY = "BOB";
export const DEFAULT_TIMEZONE = "America/La_Paz";

const role = z.enum(["owner", "assistant"]);

export const organizationSchema = z.object({
  name: z.string().trim().min(1, "La organización necesita un nombre"),
  currency: z
    .string()
    .trim()
    .length(3, "La moneda usa tres letras (BOB, USD…)")
    .transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(1, "Indica la zona horaria"),
});

export const updateOrganizationSchema = organizationSchema.extend({
  organizationId: z.guid(),
});

export const assignmentSchema = z.object({
  userId: z.guid(),
  assignments: z
    .array(
      z.object({
        organizationId: z.guid(),
        role,
        displayName: z.string().trim().min(1, "Indica el nombre visible"),
      }),
    )
    .min(1, "Elige al menos una organización"),
});

export const membershipTargetSchema = z.object({
  organizationId: z.guid(),
  membershipId: z.guid(),
});

export const membershipRoleSchema = membershipTargetSchema.extend({ role });

export const membershipNameSchema = membershipTargetSchema.extend({
  displayName: z.string().trim().min(1, "El nombre visible no puede quedar vacío"),
});

export const addAccountSchema = z.object({
  organizationId: z.guid(),
  // Se recorta antes de validar: un correo pegado trae espacios a menudo.
  email: z.string().trim().pipe(z.email("Ingresa un correo válido")),
  role,
  /** Vacío: el que la cuenta ya usa en otra organización, o su correo. */
  displayName: z.string().trim().optional(),
});
