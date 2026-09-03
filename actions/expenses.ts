"use server";

import { revalidatePath } from "next/cache";

import { getOwnerContext } from "@/lib/auth/session-context";
import { IMAGE_ACCEPT, MAX_FILE_SIZE } from "@/lib/catalog/photos";
import { expenseErrorMessage } from "@/lib/expenses/errors";
import {
  costFormSchema,
  expenseIdSchema,
  purchaseFormSchema,
} from "@/lib/expenses/schema";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { ContactService } from "@/services/catalog/contact-service";
import { ExpenseService } from "@/services/expenses/expense-service";
import { RECEIPTS_BUCKET } from "@/types";

export type ActionResult = { error: string } | undefined;

/** El alta devuelve el identificador para encolar el comprobante después. */
export type CreateExpenseResult = { error: string } | { expenseId: string };

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";
const NOT_OWNER = "Solo la persona dueña registra egresos.";

const ACCEPTED_TYPES = new Set(IMAGE_ACCEPT.split(","));

function revalidateExpenses(expenseId?: string) {
  revalidatePath("/expenses");
  if (expenseId) revalidatePath(`/expenses/${expenseId}`);
}

/**
 * Alta de gasto (V9).
 *
 * La organización la pone el contexto de sesión, nunca el formulario. La
 * guardia de dueño es la misma que RLS aplica después (matriz §16): aquí se
 * evita disparar una consulta que la base va a rechazar y se devuelve un
 * mensaje entendible.
 */
export async function createExpense(input: unknown): Promise<CreateExpenseResult> {
  const parsed = costFormSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    const expenseId = await new ExpenseService(context.supabase).createCost(
      context.organizationId,
      parsed.data,
    );
    revalidateExpenses(expenseId);
    return { expenseId };
  } catch (error) {
    return { error: expenseErrorMessage(error, "No se pudo guardar el gasto.") };
  }
}

/**
 * Alta de compra (V8). El proveedor se comprueba en el servidor: la interfaz
 * solo ofrece proveedores, pero la acción no confía en la interfaz.
 */
export async function createPurchase(input: unknown): Promise<CreateExpenseResult> {
  const parsed = purchaseFormSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    const supplier = await new ContactService(context.supabase).findById(
      context.organizationId,
      parsed.data.contactId,
    );
    if (!supplier || !supplier.isSupplier || supplier.archivedAt) {
      return { error: "Elige o crea un proveedor." };
    }

    const expenseId = await new ExpenseService(context.supabase).createPurchase(
      context.organizationId,
      parsed.data,
    );
    revalidateExpenses(expenseId);
    return { expenseId };
  } catch (error) {
    return { error: expenseErrorMessage(error, "No se pudo guardar la compra.") };
  }
}

/**
 * Comprobante del egreso. Viaja como `FormData` porque un `File` no sobrevive
 * a la serialización de una Server Action normal, y es una acción aparte del
 * alta a propósito: el egreso ya está guardado cuando esto corre, y si la
 * subida falla se reintenta desde el detalle (design D4).
 *
 * El cliente comprime antes de enviar; aquí se vuelve a comprobar el tipo y
 * el peso sin confiar en él.
 */
export async function attachReceipt(formData: FormData): Promise<ActionResult> {
  const target = expenseIdSchema.safeParse({ expenseId: formData.get("expenseId") });
  if (!target.success) return { error: "No se pudo identificar el egreso." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No llegó ningún archivo." };
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return { error: "Formato no admitido. Usa una foto JPEG, PNG, WebP o AVIF." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "El comprobante no puede pesar más de 5 MB." };
  }

  const context = await getOwnerContext();
  if (!context) return { error: NOT_OWNER };

  try {
    const expense = await new ExpenseService(context.supabase).getById(
      context.organizationId,
      target.data.expenseId,
    );
    if (!expense) return { error: "Ese egreso ya no está a tu alcance." };

    await new AttachmentService(context.supabase).upload(
      context.organizationId,
      context.userId,
      {
        // Identificador generado en el servidor: aquí no hay modo sin conexión
        // que servir, el archivo ya está viajando.
        id: crypto.randomUUID(),
        entityType: "expense",
        entityId: expense.id,
        bucket: RECEIPTS_BUCKET,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        body: await file.arrayBuffer(),
      },
    );
  } catch (error) {
    return {
      error: expenseErrorMessage(error, "No se pudo subir el comprobante."),
    };
  }

  revalidateExpenses(target.data.expenseId);
}

/**
 * Archivar y desarchivar. Quién puede hacerlo lo decide el trigger
 * `enforce_archive_rules` de la base: aquí no se comprueba el rol, solo se
 * traduce su rechazo (design D9).
 */
export async function archiveExpense(input: unknown): Promise<ActionResult> {
  return setArchived(input, true, "No se pudo archivar el egreso.");
}

export async function unarchiveExpense(input: unknown): Promise<ActionResult> {
  return setArchived(input, false, "No se pudo desarchivar el egreso.");
}

async function setArchived(
  input: unknown,
  archived: boolean,
  fallback: string,
): Promise<ActionResult> {
  const parsed = expenseIdSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el egreso." };

  const context = await getOwnerContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new ExpenseService(context.supabase).setArchived(
      context.organizationId,
      parsed.data.expenseId,
      archived,
    );
  } catch (error) {
    return { error: expenseErrorMessage(error, fallback) };
  }

  revalidateExpenses(parsed.data.expenseId);
}
