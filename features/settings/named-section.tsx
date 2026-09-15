"use client";

import type { ActionResult } from "@/actions/configuration";
import { useEntityDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";

import { ConfigTables, ENTITY_COPY } from "./config-list";
import { NamedItemDialog, type NamedItem } from "./named-item-dialog";
import { SectionHeader } from "./section-header";

/**
 * Secciones de Canales y Categorías: la misma pantalla con distinto nombre.
 * Las acciones llegan por parámetro para que este componente no conozca ninguna
 * entidad en particular; los rótulos salen de `ENTITY_COPY`.
 */
export function NamedSection({
  title,
  description,
  placeholder,
  entity,
  items,
  onCreate,
  onUpdate,
}: {
  title: string;
  description: string;
  placeholder: string;
  entity: "channel" | "category";
  items: NamedItem[];
  onCreate: (input: { name: string }) => Promise<ActionResult>;
  onUpdate: (input: { name: string; id: string }) => Promise<ActionResult>;
}) {
  const dialog = useEntityDialog<NamedItem>();

  return (
    <section>
      <SectionHeader
        title={title}
        description={description}
        action={<Button onClick={dialog.openNew}>{ENTITY_COPY[entity].createButton}</Button>}
      />

      <ConfigTables
        entity={entity}
        items={items}
        caption={title}
        labelOf={(item) => item.name}
        onEdit={dialog.openEdit}
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
        entity={entity}
        placeholder={placeholder}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />
    </section>
  );
}
