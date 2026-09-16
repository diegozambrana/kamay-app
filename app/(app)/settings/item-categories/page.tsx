import { redirect } from "next/navigation";

import { ItemCategoriesSection } from "@/features/settings/item-categories-section";
import { getOwnerContext } from "@/lib/auth/session-context";
import { itemKindSchema } from "@/lib/catalog/schema";
import { ItemCategoryService } from "@/services/configuration/item-category-service";

export const metadata = { title: "Categorías de ítem · Configuración · Kamay" };

/**
 * V15 · Categorías de ítem. Se guarda a sí misma, como toda sección de la
 * dueña (spec `org-configuration` → *The Item categories section guards
 * itself*): el ayudante no llega aquí ni por dirección directa.
 */
export default async function ItemCategoriesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const context = await getOwnerContext();
  if (!context) redirect("/dashboard");

  const { kind: requested } = await searchParams;
  const kind = itemKindSchema.safeParse(requested).data ?? "supply";

  const categories = await new ItemCategoryService(context.supabase).listByKind(
    context.organizationId,
    kind,
    { includeArchived: true },
  );

  return <ItemCategoriesSection kind={kind} categories={categories} />;
}
