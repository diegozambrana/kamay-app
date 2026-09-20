"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { updateToolConfig } from "@/actions/tools";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emptyRow,
  fromDraft,
  issuesByPath,
  toDraft,
  type Draft,
  type DraftRow,
  type DraftScalar,
} from "@/features/tools/config-draft";
import { describeSchema, type RowsField, type ScalarField } from "@/tools/describe-schema";
import { toolBySlug } from "@/tools/resolve";

/**
 * KAM-27 · El formulario de parámetros de una herramienta, **derivado de su
 * esquema** (spec `tenant-tools` → *Los parámetros se editan en un formulario
 * derivado del esquema*; design D7).
 *
 * No sabe nada de ninguna herramienta en particular: recorre los campos que
 * `describeSchema` saca del manifiesto y pinta uno por cada uno. Valida en el
 * cliente con el mismo esquema que el servidor volverá a aplicar, y pinta cada
 * error junto al campo que lo causó — también los de reglas entre campos, como
 * la curva de margen, que llegan con su camino (`marginCurve.1.margin`).
 */
export type ConfigFormProps = {
  slug: string;
  config: Record<string, unknown>;
  onSaved?: () => void;
};

const UNIT_BY_KIND = { money: "", percent: "%", number: "" } as const;

function ScalarInput({
  id,
  field,
  value,
  error,
  onChange,
  labelledBy,
}: {
  id: string;
  field: ScalarField;
  value: DraftScalar;
  error?: string;
  onChange: (value: DraftScalar) => void;
  /** En una fila el rótulo es la cabecera de la columna, no un `<label>` propio. */
  labelledBy?: string;
}) {
  const describedBy = error ? `${id}-error` : undefined;
  const common = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-labelledby": labelledBy,
  };

  if (field.type === "boolean") {
    return (
      <Checkbox
        {...common}
        checked={value === true}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
    );
  }

  if (field.type === "enum") {
    return (
      <select
        {...common}
        className="h-9 w-full max-w-xs rounded-md border bg-transparent px-2 text-sm"
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
      >
        {field.options.map((option) => (
          <option key={option} value={option}>
            {field.labels[option] ?? option}
          </option>
        ))}
      </select>
    );
  }

  const suffix = field.type === "number" ? UNIT_BY_KIND[field.kind] || field.unit : field.unit;
  return (
    <div className="flex items-center gap-2">
      <Input
        {...common}
        // Texto y no `type="number"`: así se acepta la coma decimal y el campo
        // no cambia de valor con la rueda del ratón.
        type="text"
        inputMode={field.type === "number" ? "decimal" : undefined}
        className={field.type === "number" ? "max-w-32" : "max-w-xs"}
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      {field.type === "number" && field.kind === "percent" && field.unit && (
        <span className="text-sm text-muted-foreground">{field.unit}</span>
      )}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function RowsInput({
  baseId,
  field,
  rows,
  errors,
  onChange,
}: {
  baseId: string;
  field: RowsField;
  rows: DraftRow[];
  errors: Record<string, string>;
  onChange: (rows: DraftRow[]) => void;
}) {
  const setCell = (index: number, column: string, value: DraftScalar) =>
    onChange(
      rows.map((row, i) => (i === index ? { ...row, values: { ...row.values, [column]: value } } : row)),
    );

  return (
    <div className="space-y-2" data-testid={`rows-${field.name}`}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ninguna fila.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                {field.columns.map((column) => (
                  <th
                    key={column.name}
                    id={`${baseId}-col-${column.name}`}
                    scope="col"
                    className="pr-3 pb-1 text-left font-medium text-muted-foreground"
                  >
                    {column.label}
                  </th>
                ))}
                <th className="sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key} className="align-top" data-testid={`row-${field.name}-${index}`}>
                  {field.columns.map((column) => {
                    const cellId = `${baseId}-${index}-${column.name}`;
                    const error = errors[`${field.name}.${index}.${column.name}`];
                    return (
                      <td key={column.name} className="pr-3 pb-2">
                        <ScalarInput
                          id={cellId}
                          field={column}
                          value={row.values[column.name] ?? ""}
                          error={error}
                          labelledBy={`${baseId}-col-${column.name}`}
                          onChange={(value) => setCell(index, column.name, value)}
                        />
                        <FieldError id={cellId} message={error} />
                      </td>
                    );
                  })}
                  <td className="pb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar la fila ${index + 1} de ${field.label}`}
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    >
                      <Trash2Icon aria-hidden className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, emptyRow(field.columns)])}
      >
        <PlusIcon aria-hidden className="size-4" />
        Añadir fila
      </Button>
    </div>
  );
}

export function ConfigForm({ slug, config, onSaved }: ConfigFormProps) {
  const baseId = useId();
  const tool = toolBySlug(slug);
  const fields = useMemo(() => (tool ? describeSchema(tool.configSchema) : []), [tool]);

  const [draft, setDraft] = useState<Draft>(() => toDraft(fields, config));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!tool) return null;

  const set = (name: string, value: Draft[string]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [name]: value }));
  };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setSaved(false);

    const values = fromDraft(fields, draft);
    const parsed = tool!.configSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(issuesByPath(parsed.error.issues));
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await updateToolConfig(slug, values);
      if (result?.error) {
        // El servidor valida otra vez: si rechaza, sus caminos son los mismos.
        setErrors(issuesByPath(result.issues ?? []));
        setFailure(result.error);
        return;
      }
      setSaved(true);
      onSaved?.();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" data-testid={`tool-config-${slug}`}>
      {fields.map((field) => {
        const id = `${baseId}-${field.name}`;
        // Un error de lista entera (p. ej. «al menos un ancla») llega sin índice.
        const error = errors[field.name];

        return (
          <div key={field.name} className="space-y-1.5">
            {field.type === "rows" ? (
              <p className="text-sm font-medium" id={`${id}-label`}>
                {field.label}
              </p>
            ) : (
              <Label htmlFor={id}>
                {field.label}
                {field.type === "number" && field.kind !== "percent" && field.unit
                  ? ` (${field.unit})`
                  : ""}
              </Label>
            )}
            {field.help && <p className="max-w-prose text-sm text-muted-foreground">{field.help}</p>}

            {field.type === "rows" ? (
              <RowsInput
                baseId={id}
                field={field}
                rows={(draft[field.name] as DraftRow[]) ?? []}
                errors={errors}
                onChange={(rows) => set(field.name, rows)}
              />
            ) : (
              <ScalarInput
                id={id}
                // La unidad ya va en el rótulo; junto al campo solo el «%».
                field={field.type === "number" ? { ...field, unit: undefined } : field}
                value={(draft[field.name] as DraftScalar) ?? ""}
                error={error}
                onChange={(value) => set(field.name, value)}
              />
            )}
            <FieldError id={id} message={error} />
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar parámetros"}
        </Button>
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            Parámetros guardados.
          </p>
        )}
        {failure && Object.keys(errors).length === 0 && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
      </div>
    </form>
  );
}
