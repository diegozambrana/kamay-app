import { notFound, redirect } from "next/navigation";

import { ExpenseDetail } from "@/features/expenses/expense-detail";
import { loadExpenseDetail } from "@/features/expenses/load-expense-detail";
import { getOwnerContext } from "@/lib/auth/session-context";

export const metadata = { title: "Egreso · Kamay" };

/**
 * Detalle de egreso a página completa: el destino de los enlaces que vendrán
 * de contactos, reportes y tareas. Es el mismo componente que el panel de la
 * bandeja (design D6).
 */
export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getOwnerContext();
  if (!context) redirect("/auth/login");

  const { id } = await params;
  const data = await loadExpenseDetail(context, id);
  if (!data) notFound();

  return (
    <ExpenseDetail
      data={data}
      timezone={context.membership.organization.timezone}
      variant="page"
    />
  );
}
