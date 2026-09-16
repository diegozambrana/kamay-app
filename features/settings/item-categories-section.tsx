"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  createItemCategory,
  updateItemCategory,
} from "@/actions/configuration";
import { useEntityDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ITEM_CATEGORY_COPY, ITEM_KIND_LABELS } from "@/lib/catalog/labels";
import { ITEM_KINDS, type ItemCategory, type ItemKind } from "@/types";

import { ConfigTables, ENTITY_COPY } from "./config-list";
import { NamedItemDialog, type NamedItem } from "./named-item-dialog";
import { SectionHeader } from "./section-header";

/**
 * «Categorías de ítem» (V15). Una lista por tipo, con las mismas pestañas que
 * el catálogo: la categoría se crea en la pestaña activa y su tipo no cambia
 * después, así que el diálogo no lo pregunta (design D5).
 *
 * La pestaña vive en la dirección (`?kind=`) como en el catálogo: la página
 * entrega las categorías de ese tipo, vigentes y archivadas.
 */
export function ItemCategoriesSection({
  kind,
  categories,
}: {
  kind: ItemKind;
  categories: ItemCategory[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const dialog = useEntityDialog<NamedItem>();
  const kindCopy = ITEM_CATEGORY_COPY[kind];
  const copy = {
    empty: kindCopy.empty,
    newTitle: kindCopy.newTitle,
    editTitle: kindCopy.editTitle,
  };

  return (
    <section>
      <SectionHeader
        title="Categorías de ítem"
        description="Cómo se agrupa el catálogo. Cada tipo de ítem tiene su propia lista."
        action={
          <Button onClick={dialog.openNew}>
            {ENTITY_COPY.itemCategory.createButton}
          </Button>
        }
      />

      <ToggleGroup
        type="single"
        variant="outline"
        value={kind}
        // Radix emite "" al deseleccionar: siempre hay un tipo elegido.
        onValueChange={(value) => value && router.push(`${pathname}?kind=${value}`)}
        aria-label="Tipo de ítem"
        className="mb-4 w-fit"
      >
        {ITEM_KINDS.map((candidate) => (
          <ToggleGroupItem key={candidate} value={candidate}>
            {ITEM_KIND_LABELS[candidate]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ConfigTables
        entity="itemCategory"
        items={categories}
        caption={`Categorías de ${ITEM_KIND_LABELS[kind].toLowerCase()}`}
        labelOf={(item) => item.name}
        onEdit={dialog.openEdit}
        copy={copy}
        columns={[
          {
            key: "name",
            header: "Nombre",
            cell: (item) => <span className="font-medium">{item.name}</span>,
          },
        ]}
      />

      <NamedItemDialog
        dialog={dialog}
        entity="itemCategory"
        placeholder="Sustratos"
        copy={copy}
        onCreate={(input) => createItemCategory({ ...input, kind })}
        onUpdate={updateItemCategory}
      />
    </section>
  );
}
