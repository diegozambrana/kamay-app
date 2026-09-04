import "server-only";

import type { SessionContext } from "@/lib/auth/session-context";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { ContactService } from "@/services/catalog/contact-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ExpenseCategoryService } from "@/services/configuration/expense-category-service";
import { ExpenseItemService } from "@/services/expenses/expense-item-service";
import { ExpenseService } from "@/services/expenses/expense-service";
import { OrderService } from "@/services/orders/order-service";
import { PaymentService } from "@/services/payments/payment-service";

import type { ExpenseDetailData } from "./expense-detail";

/**
 * Todo lo que el detalle necesita, resuelto en el servidor. Lo comparten la
 * página `/expenses/[id]` y el panel lateral de la bandeja (`?selected=`),
 * para que ambos muestren exactamente lo mismo (design D6).
 */
export async function loadExpenseDetail(
  context: SessionContext,
  id: string,
): Promise<ExpenseDetailData | null> {
  const { supabase, organizationId } = context;

  const expenses = new ExpenseService(supabase);
  const expense = await expenses.getById(organizationId, id);
  if (!expense) return null;

  const [
    lines,
    supplier,
    categories,
    businessLines,
    order,
    receipts,
    payments,
    history,
  ] =
    await Promise.all([
      expense.kind === "purchase"
        ? new ExpenseItemService(supabase).listByExpense(organizationId, expense.id)
        : Promise.resolve([]),
      expense.contactId
        ? new ContactService(supabase).findById(organizationId, expense.contactId)
        : Promise.resolve(null),
      new ExpenseCategoryService(supabase).listAll(organizationId),
      new BusinessLineService(supabase).listAll(organizationId),
      expense.orderId
        ? new OrderService(supabase).getById(organizationId, expense.orderId)
        : Promise.resolve(null),
      new AttachmentService(supabase).listForEntities(organizationId, "expense", [
        expense.id,
      ]),
      // Movimientos del egreso, anulados incluidos: el bloque los muestra
      // tachados. Lo que cuenta en `paid` lo decide la vista, no esta lista.
      new PaymentService(supabase).listForExpense(organizationId, expense.id),
      expenses.history(organizationId, expense.id),
    ]);

  // El bucket es privado: cada lectura se firma.
  const signed = await new AttachmentService(supabase).signedUrls(receipts);

  return {
    expense,
    lines,
    supplier,
    categoryName:
      categories.find((category) => category.id === expense.expenseCategoryId)?.name ??
      null,
    businessLine:
      businessLines.find((line) => line.id === expense.businessLineId) ?? null,
    order: order ? { id: order.id, code: order.code } : null,
    receipts: receipts.map((receipt) => ({
      id: receipt.id,
      fileName: receipt.fileName,
      sizeBytes: receipt.sizeBytes,
      url: signed.get(receipt.id) ?? null,
    })),
    payments,
    history,
  };
}
