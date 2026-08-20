import { redirect } from "next/navigation";

import {
  createExpenseCategory,
  updateExpenseCategory,
} from "@/actions/configuration";
import { NamedSection } from "@/features/settings/named-section";
import { getOwnerContext } from "@/lib/auth/session-context";
import { ExpenseCategoryService } from "@/services/configuration/expense-category-service";

export const metadata = { title: "Categorías · Configuración · Kamay" };

export default async function CategoriesSettingsPage() {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const categories = await new ExpenseCategoryService(context.supabase).listAll(
    context.organizationId,
  );

  return (
    <NamedSection
      title="Categorías de gasto"
      description="Cómo se agrupan los egresos."
      placeholder="Insumos"
      entity="category"
      items={categories}
      onCreate={createExpenseCategory}
      onUpdate={updateExpenseCategory}
    />
  );
}
