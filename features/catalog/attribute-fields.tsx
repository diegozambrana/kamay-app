"use client";

import { useState } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ATTRIBUTE_FIELD_PREFIX,
  isRetiredOption,
  parseHexColor,
} from "@/lib/catalog/attributes";
import { NO_ATTRIBUTE_VALUE_LABEL, RETIRED_OPTION_SUFFIX } from "@/lib/catalog/labels";
import type { AttributeValues, ItemCategoryAttribute } from "@/types";

/** Radix no admite una opción con valor vacío: «sin indicar» se nombra. */
const NO_VALUE = "__none__";

/**
 * Los campos de atributo de un formulario de ítem o de variante
 * (`catalog-custom-attributes`, design D3), en el orden de la definición.
 *
 * Cada campo se llama `attr:<id del atributo>`; `attributeInputsFrom` los lee
 * del `FormData` y `attributesSchema` los valida, en el cliente y en el
 * servidor. Una opción retirada que el registro ya tenía se muestra como su
 * valor actual, rotulada, y se envía tal cual si nadie la cambia.
 *
 * Quien lo usa le da una `key` por categoría: al cambiar de categoría los
 * campos vuelven a empezar.
 */
export function AttributeFields({
  fields,
  values,
  idPrefix,
}: {
  fields: readonly ItemCategoryAttribute[];
  /** Lo guardado: el valor inicial de cada campo. */
  values: AttributeValues;
  /** Para que dos formularios en la misma pantalla no repitan ids. */
  idPrefix: string;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="attribute-fields">
      {fields.map((field) => (
        <AttributeField
          key={field.id}
          field={field}
          value={values[field.id]}
          id={`${idPrefix}-attr-${field.id}`}
        />
      ))}
    </div>
  );
}

function AttributeField({
  field,
  value,
  id,
}: {
  field: ItemCategoryAttribute;
  value: unknown;
  id: string;
}) {
  const name = `${ATTRIBUTE_FIELD_PREFIX}${field.id}`;
  const initial = value === undefined || value === null ? "" : String(value);
  const hint = field.required ? <FieldDescription>Obligatorio.</FieldDescription> : null;

  if (field.type === "list") {
    return <ListField field={field} name={name} id={id} initial={initial} hint={hint} />;
  }

  if (field.type === "color") {
    return <ColorField field={field} name={name} id={id} initial={initial} hint={hint} />;
  }

  if (field.type === "number") {
    return (
      <Field>
        <FieldLabel htmlFor={id}>{field.name}</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id={id}
            name={name}
            inputMode="decimal"
            defaultValue={initial}
            aria-required={field.required}
            autoComplete="off"
          />
          {field.unit && (
            <InputGroupAddon align="inline-end">
              <InputGroupText>{field.unit}</InputGroupText>
            </InputGroupAddon>
          )}
        </InputGroup>
        {hint}
      </Field>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{field.name}</FieldLabel>
      <Input
        id={id}
        name={name}
        defaultValue={initial}
        aria-required={field.required}
        autoComplete="off"
        maxLength={200}
      />
      {hint}
    </Field>
  );
}

/**
 * Un color: el selector nativo y el hex escrito, sincronizados (design D11).
 * Lo que se envía es el campo de texto, que puede quedar vacío; el selector
 * nativo no admite «sin color» y por eso no lleva nombre.
 */
function ColorField({
  field,
  name,
  id,
  initial,
  hint,
}: {
  field: ItemCategoryAttribute;
  name: string;
  id: string;
  initial: string;
  hint: React.ReactNode;
}) {
  const [text, setText] = useState(initial);
  const picked = parseHexColor(text);

  return (
    <Field>
      <FieldLabel htmlFor={id}>{field.name}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Elegir ${field.name}`}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
          value={(picked ?? "#000000").toLowerCase()}
          onChange={(event) => setText(event.target.value.toUpperCase())}
          data-testid="color-picker"
        />
        <Input
          id={id}
          name={name}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="#1A1A1A"
          aria-required={field.required}
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
        />
      </div>
      {hint ?? <FieldDescription>Elígelo o escribe el hex.</FieldDescription>}
    </Field>
  );
}

function ListField({
  field,
  name,
  id,
  initial,
  hint,
}: {
  field: ItemCategoryAttribute;
  name: string;
  id: string;
  initial: string;
  hint: React.ReactNode;
}) {
  const [selected, setSelected] = useState(initial === "" ? NO_VALUE : initial);
  const retired = isRetiredOption(field, initial) ? initial : null;

  return (
    <Field>
      <FieldLabel htmlFor={id}>{field.name}</FieldLabel>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger id={id} className="w-full" aria-required={field.required}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={NO_VALUE}>{NO_ATTRIBUTE_VALUE_LABEL}</SelectItem>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
            {retired && (
              <SelectItem value={retired}>
                {retired} {RETIRED_OPTION_SUFFIX}
              </SelectItem>
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={selected === NO_VALUE ? "" : selected} />
      {hint}
    </Field>
  );
}
