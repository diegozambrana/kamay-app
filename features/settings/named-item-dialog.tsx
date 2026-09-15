"use client";

import type { ActionResult } from "@/actions/configuration";
import { FormDialog, type EntityDialog } from "@/components/shared/form-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { ENTITY_COPY } from "./config-list";

export type NamedItem = { id: string; name: string; archivedAt: string | null };

/**
 * Alta y edición de un canal o una categoría: solo el nombre. Las acciones
 * llegan por parámetro para que el diálogo no conozca ninguna entidad.
 */
export function NamedItemDialog({
  dialog,
  entity,
  placeholder,
  onCreate,
  onUpdate,
}: {
  dialog: EntityDialog<NamedItem>;
  entity: "channel" | "category";
  placeholder: string;
  onCreate: (input: { name: string }) => Promise<ActionResult>;
  onUpdate: (input: { name: string; id: string }) => Promise<ActionResult>;
}) {
  const copy = ENTITY_COPY[entity];
  const item = dialog.target;

  return (
    <FormDialog
      open={dialog.open}
      onOpenChange={dialog.onOpenChange}
      title={item ? copy.editTitle : copy.newTitle}
      submitLabel={item ? "Guardar cambios" : copy.createSubmit}
      pending={dialog.pending}
      error={dialog.error}
      data-testid={`${entity}-dialog`}
      onSubmit={(data) => {
        const name = String(data.get("name") ?? "");
        dialog.submit(() => (item ? onUpdate({ name, id: item.id }) : onCreate({ name })));
      }}
    >
      <Field>
        <FieldLabel htmlFor={`${entity}-name`}>Nombre</FieldLabel>
        <Input
          id={`${entity}-name`}
          name="name"
          defaultValue={item?.name ?? ""}
          placeholder={placeholder}
          autoComplete="off"
          required
        />
      </Field>
    </FormDialog>
  );
}
