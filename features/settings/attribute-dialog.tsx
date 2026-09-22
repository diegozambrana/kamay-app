"use client";

import { useState } from "react";

import type { ActionResult } from "@/actions/configuration";
import { FormDialog, type EntityDialog } from "@/components/shared/form-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { optionsFromText } from "@/lib/catalog/attribute-definition-schema";
import { ATTRIBUTE_SCOPE_LABELS, ATTRIBUTE_TYPE_LABELS } from "@/lib/catalog/labels";
import {
  ATTRIBUTE_SCOPES,
  ATTRIBUTE_TYPES,
  type AttributeScope,
  type AttributeType,
  type ItemCategoryAttribute,
} from "@/types";

import { ENTITY_COPY } from "./config-list";

export type AttributeCreateInput = {
  name: string;
  type: AttributeType;
  scope: AttributeScope;
  unit: string;
  options: string[];
  required: boolean;
};

export type AttributeUpdateInput = {
  id: string;
  name: string;
  unit: string;
  options: string[];
  required: boolean;
};

/**
 * Alta y edición de un atributo de categoría (`catalog-custom-attributes`,
 * spec `settings-interaction`).
 *
 * Unidad aparece solo para números y Opciones solo para listas. En la edición
 * no se dibujan Tipo ni Aplica a: no cambian después de creados, y el tipo
 * guardado decide qué campos se muestran.
 *
 * Las acciones llegan por parámetro, como en `NamedItemDialog`: el diálogo no
 * conoce la categoría.
 */
export function AttributeDialog({
  dialog,
  onCreate,
  onUpdate,
}: {
  dialog: EntityDialog<ItemCategoryAttribute>;
  onCreate: (input: AttributeCreateInput) => Promise<ActionResult>;
  onUpdate: (input: AttributeUpdateInput) => Promise<ActionResult>;
}) {
  const copy = ENTITY_COPY.itemCategoryAttribute;
  const attribute = dialog.target;

  return (
    <FormDialog
      open={dialog.open}
      onOpenChange={dialog.onOpenChange}
      title={attribute ? copy.editTitle : copy.newTitle}
      submitLabel={attribute ? "Guardar cambios" : copy.createSubmit}
      pending={dialog.pending}
      error={dialog.error}
      data-testid="attribute-dialog"
      onSubmit={(data) => {
        const name = String(data.get("name") ?? "");
        const unit = String(data.get("unit") ?? "");
        // Opciones solo existe en el formulario de una lista.
        const options = data.has("options")
          ? optionsFromText(String(data.get("options") ?? ""))
          : [];
        const required = data.get("required") === "on";

        dialog.submit(() =>
          attribute
            ? onUpdate({ id: attribute.id, name, unit, options, required })
            : onCreate({
                name,
                unit,
                options,
                required,
                type: String(data.get("type") ?? "") as AttributeType,
                scope: String(data.get("scope") ?? "") as AttributeScope,
              }),
        );
      }}
    >
      {/* La clave reinicia los campos al pasar de un atributo a otro. */}
      <AttributeFields key={attribute?.id ?? "new"} attribute={attribute} />
    </FormDialog>
  );
}

function AttributeFields({ attribute }: { attribute: ItemCategoryAttribute | null }) {
  const [type, setType] = useState<AttributeType>(attribute?.type ?? "text");
  const [scope, setScope] = useState<AttributeScope>(attribute?.scope ?? "item");
  const [required, setRequired] = useState(attribute?.required ?? false);
  const editing = attribute !== null;

  return (
    <>
      <Field>
        <FieldLabel htmlFor="attribute-name">Nombre</FieldLabel>
        <Input
          id="attribute-name"
          name="name"
          defaultValue={attribute?.name ?? ""}
          placeholder="Color"
          autoComplete="off"
          required
        />
      </Field>

      {!editing && (
        <Field>
          <FieldLabel htmlFor="attribute-type">Tipo</FieldLabel>
          <Select value={type} onValueChange={(value) => setType(value as AttributeType)}>
            <SelectTrigger id="attribute-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {ATTRIBUTE_TYPES.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {ATTRIBUTE_TYPE_LABELS[candidate]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <input type="hidden" name="type" value={type} />
          <FieldDescription>No se puede cambiar después.</FieldDescription>
        </Field>
      )}

      {type === "number" && (
        <Field>
          <FieldLabel htmlFor="attribute-unit">Unidad</FieldLabel>
          <Input
            id="attribute-unit"
            name="unit"
            defaultValue={attribute?.unit ?? ""}
            placeholder="°C"
            autoComplete="off"
          />
          <FieldDescription>Opcional. Se muestra junto al número.</FieldDescription>
        </Field>
      )}

      {type === "list" && (
        <Field>
          <FieldLabel htmlFor="attribute-options">Opciones</FieldLabel>
          <Textarea
            id="attribute-options"
            name="options"
            defaultValue={attribute?.options.join("\n") ?? ""}
            placeholder={"Negro\nBlanco\nRojo"}
            rows={4}
          />
          <FieldDescription>
            Una por línea. Quitar una opción no borra los valores que ya la usan.
          </FieldDescription>
        </Field>
      )}

      {!editing && (
        <Field>
          <FieldLabel htmlFor="attribute-scope">Aplica a</FieldLabel>
          <Select value={scope} onValueChange={(value) => setScope(value as AttributeScope)}>
            <SelectTrigger id="attribute-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {ATTRIBUTE_SCOPES.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {ATTRIBUTE_SCOPE_LABELS[candidate]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <input type="hidden" name="scope" value={scope} />
          <FieldDescription>
            Al ítem si describe al ítem entero (la marca); a la variante si cambia en cada una
            (el color). No se puede cambiar después.
          </FieldDescription>
        </Field>
      )}

      <div className="flex items-start gap-3">
        <Checkbox
          id="attribute-required"
          checked={required}
          onCheckedChange={(value) => setRequired(value === true)}
        />
        {required && <input type="hidden" name="required" value="on" />}
        <div className="-mt-0.5">
          <Label htmlFor="attribute-required">Obligatorio</Label>
          <p className="text-muted-foreground text-xs">
            No se puede guardar un ítem o una variante sin este dato.
          </p>
        </div>
      </div>
    </>
  );
}
