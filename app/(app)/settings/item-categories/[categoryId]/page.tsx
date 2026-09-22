import { notFound, redirect } from "next/navigation";

import { CategoryAttributesSection } from "@/features/settings/category-attributes-section";
import { getOwnerContext } from "@/lib/auth/session-context";
import { ItemCategoryAttributeService } from "@/services/configuration/item-category-attribute-service";
import { ItemCategoryService } from "@/services/configuration/item-category-service";

export const metadata = { title: "Atributos de categoría · Configuración · Kamay" };

/**
 * V15 · Atributos de una categoría de ítem (`catalog-custom-attributes`,
 * design D5). Se guarda a sí misma, como toda sección de la dueña: el
 * ayudante no llega aquí ni por dirección directa.
 */
export default async function CategoryAttributesPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const { categoryId } = await params;
  const category = await new ItemCategoryService(context.supabase).findById(
    context.organizationId,
    categoryId,
  );
  if (!category) notFound();

  const attributes = await new ItemCategoryAttributeService(
    context.supabase,
  ).listForCategory(context.organizationId, category.id, { includeArchived: true });

  return <CategoryAttributesSection category={category} attributes={attributes} />;
}
