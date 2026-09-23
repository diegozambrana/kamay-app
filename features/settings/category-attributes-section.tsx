"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import {
  createItemCategoryAttribute,
  updateItemCategoryAttribute,
} from "@/actions/configuration";
import { useEntityDialog } from "@/components/shared/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ATTRIBUTE_SCOPE_LABELS,
  ITEM_KIND_SINGULAR,
  attributeTypeSummary,
} from "@/lib/catalog/labels";
import type { ItemCategory, ItemCategoryAttribute } from "@/types";

import { AttributeDialog } from "./attribute-dialog";
import { ConfigTables, ENTITY_COPY } from "./config-list";
import { SectionHeader } from "./section-header";

/**
 * Los atributos de una categoría de ítem (`catalog-custom-attributes`, spec
 * `settings-interaction` → *The attributes of an item category follow the
 * configuration pattern*). Mismo patrón que el resto de Configuración: tabla
 * con «⋯», alta y edición en diálogo, archivado confirmado y «Archivados».
 *
 * Se declaran una vez aquí y sirven para todos los ítems de la categoría.
 */
export function CategoryAttributesSection({
  category,
  attributes,
}: {
  category: ItemCategory;
  attributes: ItemCategoryAttribute[];
}) {
  const dialog = useEntityDialog<ItemCategoryAttribute>();

  return (
    <section>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href={`/settings/item-categories?kind=${category.kind}`}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          Categorías de ítem
        </Link>
      </Button>

      <SectionHeader
        title={`Atributos de «${category.name}»`}
        description={
          <>
            Los datos que describen a los ítems de esta categoría de{" "}
            {ITEM_KIND_SINGULAR[category.kind].toLowerCase()}, o a cada una de sus variantes. Se
            piden en sus formularios y se muestran en su detalle.
          </>
        }
        action={
          <Button onClick={dialog.openNew}>
            {ENTITY_COPY.itemCategoryAttribute.createButton}
          </Button>
        }
      />

      {category.archivedAt && (
        <p className="mb-4 text-sm text-muted-foreground" data-testid="category-archived-notice">
          Esta categoría está archivada: no se ofrece para ítems nuevos, pero los que ya la usan
          siguen pidiendo estos atributos.
        </p>
      )}

      <ConfigTables
        entity="itemCategoryAttribute"
        items={attributes}
        caption={`Atributos de ${category.name}`}
        labelOf={(attribute) => attribute.name}
        onEdit={dialog.openEdit}
        columns={[
          {
            key: "name",
            header: "Nombre",
            cell: (attribute) => <span className="font-medium">{attribute.name}</span>,
          },
          {
            key: "type",
            header: "Tipo",
            cell: (attribute) => attributeTypeSummary(attribute),
          },
          {
            key: "required",
            header: "Obligatorio",
            cell: (attribute) =>
              attribute.required ? <Badge variant="secondary">Obligatorio</Badge> : null,
          },
          {
            key: "scope",
            header: "Aplica a",
            cell: (attribute) => ATTRIBUTE_SCOPE_LABELS[attribute.scope],
          },
        ]}
      />

      <AttributeDialog
        dialog={dialog}
        onCreate={(input) =>
          createItemCategoryAttribute({
            ...input,
            categoryId: category.id,
            unit: input.unit || null,
          })
        }
        onUpdate={(input) =>
          updateItemCategoryAttribute({ ...input, unit: input.unit || null })
        }
      />
    </section>
  );
}
