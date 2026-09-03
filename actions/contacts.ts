"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session-context";
import { catalogErrorMessage } from "@/lib/catalog/errors";
import { contactFormSchema, quickContactSchema } from "@/lib/catalog/schema";
import { ContactService } from "@/services/catalog/contact-service";
import type { Contact } from "@/types";

export type ActionResult = { error: string } | undefined;

/** La creación al vuelo necesita devolver el contacto para seleccionarlo. */
export type ContactResult = { error: string } | { contact: Contact };

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";
const NOT_OWNER = "Solo la persona dueña puede archivar o desarchivar.";

const id = z.guid();

function revalidateContacts() {
  revalidatePath("/contacts");
}

export async function createContact(
  input: z.input<typeof contactFormSchema> & { id: string },
): Promise<ActionResult> {
  const parsedId = id.safeParse(input.id);
  const parsed = contactFormSchema.safeParse(input);
  if (!parsedId.success) return { error: "No se pudo identificar el contacto." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new ContactService(context.supabase).create(
      context.organizationId,
      parsedId.data,
      parsed.data,
    );
  } catch (error) {
    return { error: catalogErrorMessage(error, "No se pudo crear el contacto.") };
  }

  revalidateContacts();
}

export async function updateContact(
  input: z.input<typeof contactFormSchema> & { id: string },
): Promise<ActionResult> {
  const parsedId = id.safeParse(input.id);
  const parsed = contactFormSchema.safeParse(input);
  if (!parsedId.success) return { error: "No se pudo identificar el contacto." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new ContactService(context.supabase).update(
      context.organizationId,
      parsedId.data,
      parsed.data,
    );
  } catch (error) {
    return {
      error: catalogErrorMessage(error, "No se pudo guardar el contacto."),
    };
  }

  revalidateContacts();
}

const archiveSchema = z.object({ id, archived: z.boolean() });

export async function setContactArchived(
  input: z.infer<typeof archiveSchema>,
): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el contacto." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };
  if (context.membership.role !== "owner") return { error: NOT_OWNER };

  try {
    await new ContactService(context.supabase).setArchived(
      context.organizationId,
      parsed.data.id,
      parsed.data.archived,
    );
  } catch (error) {
    return {
      error: catalogErrorMessage(
        error,
        parsed.data.archived
          ? "No se pudo archivar el contacto."
          : "No se pudo desarchivar el contacto.",
      ),
    };
  }

  revalidateContacts();
}

/**
 * Creación al vuelo desde cualquier buscador de contactos: nombre y al menos
 * un rol. El resto de los datos se completan después desde el directorio.
 * Devuelve el contacto para que el buscador lo deje seleccionado sin recargar
 * el formulario en curso.
 */
export async function createContactInline(
  // `z.input`: el teléfono llega del campo como texto, y es el esquema quien
  // convierte el vacío en ausencia de dato.
  input: z.input<typeof quickContactSchema>,
): Promise<ContactResult> {
  const parsed = quickContactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const contact = await new ContactService(context.supabase).create(
      context.organizationId,
      parsed.data.id,
      {
        name: parsed.data.name,
        // El teléfono se pide en el mismo paso desde KAM-08: al registrar un
        // pedido es el dato que hace falta a continuación.
        phone: parsed.data.phone,
        email: null,
        address: null,
        notes: null,
        isSupplier: parsed.data.isSupplier,
        isCustomer: parsed.data.isCustomer,
      },
    );

    revalidateContacts();
    return { contact };
  } catch (error) {
    return { error: catalogErrorMessage(error, "No se pudo crear el contacto.") };
  }
}
