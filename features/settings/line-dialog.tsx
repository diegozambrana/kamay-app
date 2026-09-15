"use client";

import { createBusinessLine, updateBusinessLine } from "@/actions/configuration";
import { FormDialog, type EntityDialog } from "@/components/shared/form-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { BusinessLine, LineColor } from "@/types";

import { ColorSelect } from "./color-select";
import { ENTITY_COPY } from "./config-list";

const copy = ENTITY_COPY.line;

/** Alta y edición de una línea de negocio: nombre y color. */
export function LineDialog({ dialog }: { dialog: EntityDialog<BusinessLine> }) {
  const line = dialog.target;

  return (
    <FormDialog
      open={dialog.open}
      onOpenChange={dialog.onOpenChange}
      title={line ? copy.editTitle : copy.newTitle}
      description="Cada línea tiene sus propias cuentas y su propio color."
      submitLabel={line ? "Guardar cambios" : copy.createSubmit}
      pending={dialog.pending}
      error={dialog.error}
      data-testid="line-dialog"
      onSubmit={(data) => {
        const values = {
          name: String(data.get("name") ?? ""),
          color: String(data.get("color") ?? "zinc") as LineColor,
        };
        dialog.submit(() =>
          line ? updateBusinessLine({ ...values, id: line.id }) : createBusinessLine(values),
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor="line-name">Nombre</FieldLabel>
        <Input
          id="line-name"
          name="name"
          defaultValue={line?.name ?? ""}
          placeholder="Sublimación"
          autoComplete="off"
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="line-color">Color</FieldLabel>
        <ColorSelect id="line-color" name="color" defaultValue={line?.color ?? "zinc"} />
      </Field>
    </FormDialog>
  );
}
