import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { lineCookieName } from "@/constants/auth";
import { ExpensesScreen } from "@/features/expenses/expenses-screen";
import { loadExpenseDetail } from "@/features/expenses/load-expense-detail";
import { getOwnerContext } from "@/lib/auth/session-context";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import {
  resolvePeriod,
  startOfDayInTimezone,
  startOfNextDayInTimezone,
} from "@/lib/expenses/period";
import { summarize } from "@/lib/expenses/totals";
import { todayInTimezone } from "@/lib/orders/overdue";
import { ContactService } from "@/services/catalog/contact-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ExpenseCategoryService } from "@/services/configuration/expense-category-service";
import { ExpenseService } from "@/services/expenses/expense-service";
import { PaymentService } from "@/services/payments/payment-service";
import { ALL_LINES, EXPENSE_KINDS, type ExpenseKind } from "@/types";

export const metadata = { title: "Egresos · Kamay" };

/**
 * V7 · Egresos. Los filtros viven en la dirección para que la bandeja sea
 * enlazable; la línea la da el selector global; el periodo por defecto es el
 * mes en curso en la zona horaria de la organización (design D6).
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    contact?: string;
    category?: string;
    from?: string;
    to?: string;
    archived?: string;
    selected?: string;
  }>;
}) {
  const context = await getOwnerContext();
  if (!context) redirect("/auth/login");

  const params = await searchParams;
  const timezone = context.membership.organization.timezone;
  const today = todayInTimezone(timezone);

  const kind: ExpenseKind | null = EXPENSE_KINDS.includes(params.kind as ExpenseKind)
    ? (params.kind as ExpenseKind)
    : null;
  const period = resolvePeriod(params.from, params.to, today);
  const includeArchived = params.archived === "1";

  const lines = await new BusinessLineService(context.supabase).listAll(
    context.organizationId,
  );
  const activeLine = resolveActiveLine(
    (await cookies()).get(lineCookieName(context.organizationId))?.value,
    lines.filter((line) => line.archivedAt === null),
  );
  const activeLineId = activeLine === ALL_LINES ? null : activeLine;

  const [expenses, contacts, categories] = await Promise.all([
    new ExpenseService(context.supabase).list(context.organizationId, {
      businessLineId: activeLineId,
      kind,
      contactId: params.contact || null,
      expenseCategoryId: params.category || null,
      // Del inicio del primer día al inicio del día siguiente al último, en la
      // zona del taller: el borde del mes no se corre unas horas.
      from: startOfDayInTimezone(period.from, timezone),
      to: startOfNextDayInTimezone(period.to, timezone),
      includeArchived,
    }),
    // Con archivados: un egreso vigente puede apuntar a un proveedor ya
    // archivado, y su nombre tiene que seguir apareciendo.
    new ContactService(context.supabase).list(context.organizationId, {
      role: "supplier",
      includeArchived: true,
    }),
    new ExpenseCategoryService(context.supabase).listAll(context.organizationId),
  ]);

  const contactNames = new Map(contacts.map((contact) => [contact.id, contact.name]));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const linesById = new Map(lines.map((line) => [line.id, line]));

  const rows = expenses.map((expense) => {
    const line = linesById.get(expense.businessLineId);
    return {
      ...expense,
      lineName: line?.name ?? "—",
      lineColor: line?.color ?? ("zinc" as const),
      counterpartyName:
        expense.kind === "purchase"
          ? (expense.contactId ? (contactNames.get(expense.contactId) ?? null) : null)
          : (expense.expenseCategoryId
              ? (categoryNames.get(expense.expenseCategoryId) ?? null)
              : null),
    };
  });

  // Los totales del periodo se suman al leer, sobre el conjunto ya filtrado:
  // nunca en una columna ni en un store (convención nº 4).
  const summary = summarize(rows.filter((row) => row.archivedAt === null));

  // Por pagar por línea: mismo mecanismo que Por cobrar en el tablero.
  const payables = await new PaymentService(context.supabase).payables(
    context.organizationId,
  );

  const selected = params.selected
    ? await loadExpenseDetail(context, params.selected)
    : null;

  return (
    <ExpensesScreen
      rows={rows}
      summary={summary}
      suppliers={contacts.filter((contact) => contact.archivedAt === null)}
      categories={categories.filter((category) => category.archivedAt === null)}
      activeLineId={activeLineId}
      payables={payables}
      filters={{
        kind,
        contactId: params.contact ?? "",
        expenseCategoryId: params.category ?? "",
        from: period.from,
        to: period.to,
        includeArchived,
      }}
      selected={selected}
      timezone={timezone}
    />
  );
}
