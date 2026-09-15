"use client";

import { createUnit, updateUnit } from "@/actions/configuration";
import { FormDialog, type EntityDialog } from "@/components/shared/form-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Unit } from "@/types";

import { ENTITY_COPY } from "./config-list";

const copy = ENTITY_COPY.unit;

/** Alta y edición de una unidad: el código visible ('u', 'kg'…) y su nombre. */
export function UnitDialog({ dialog }: { dialog: EntityDialog<Unit> }) {
  const unit = dialog.target;

  return (
    <FormDialog
      open={dialog.open}
      onOpenChange={dialog.onOpenChange}
      title={unit ? copy.editTitle : copy.newTitle}
      submitLabel={unit ? "Guardar cambios" : copy.createSubmit}
      pending={dialog.pending}
      error={dialog.error}
      data-testid="unit-dialog"
      onSubmit={(data) => {
        const values = {
          code: String(data.get("code") ?? ""),
          name: String(data.get("name") ?? ""),
        };
        dialog.submit(() => (unit ? updateUnit({ ...values, id: unit.id }) : createUnit(values)));
      }}
    >
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Field>
          <FieldLabel htmlFor="unit-code">Código</FieldLabel>
          <Input
            id="unit-code"
            name="code"
            defaultValue={unit?.code ?? ""}
            placeholder="kg"
            maxLength={10}
            autoComplete="off"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="unit-name">Nombre</FieldLabel>
          <Input
            id="unit-name"
            name="name"
            defaultValue={unit?.name ?? ""}
            placeholder="Kilogramo"
            autoComplete="off"
            required
          />
        </Field>
      </div>
    </FormDialog>
  );
}
