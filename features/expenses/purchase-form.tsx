"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { createPurchase } from "@/actions/expenses";
import { MainContainer } from "@/components/layout/main-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ContactCombobox } from "@/features/contacts/contact-combobox";
import { DiscardGuard } from "@/features/orders/discard-guard";
import { occurredAtForDate } from "@/lib/expenses/period";
import {
  purchaseFormSchema,
  type PurchaseFormInput,
  type PurchaseFormValues,
} from "@/lib/expenses/schema";
import type { PickableItem } from "@/lib/orders/lines";
import type { BusinessLine, Contact } from "@/types";

import {
  PurchaseLinesTable,
  type LastCostHint,
  type PurchaseEditorLine,
  type PurchaseLineErrors,
  type PurchaseLineNames,
} from "./purchase-lines-table";
import { ReceiptField } from "./receipt-field";
import { useReceiptUploadStore } from "./receipt-upload-store";

/** Los errores de cada fila, si el array trae alguno. */
function lineIssuesOf(items: unknown): (PurchaseLineErrors | undefined)[] {
  if (!Array.isArray(items)) return [];
  return items.map((issue) => {
    if (!issue) return undefined;
    const line = issue as Record<string, { message?: string } | undefined>;
    return { quantity: line.quantity?.message, unitPrice: line.unitPrice?.message };
  });
}

/**
 * V8 · Nueva compra: proveedor con creación al vuelo, línea heredada, tabla
 * editable de insumos con la pista del último precio, total en vivo y
 * comprobante. Sin proveedor o sin al menos una fila no se guarda, y el campo
 * queda señalado (criterio 2 del backlog).
 *
 * El comprobante se encola DESPUÉS de guardar (design D4).
 */
export function PurchaseForm({
  defaultLineId,
  lines,
  suppliers,
  supplies,
  hints,
  today,
  timezone,
}: {
  defaultLineId: string;
  lines: BusinessLine[];
  suppliers: Contact[];
  supplies: PickableItem[];
  /** Último precio por insumo, ya con el nombre del proveedor (design D3). */
  hints: Record<string, LastCostHint>;
  today: string;
  timezone: string;
}) {
  const router = useRouter();
  const enqueue = useReceiptUploadStore((state) => state.enqueue);

  const form = useForm<PurchaseFormInput, unknown, PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      id: crypto.randomUUID(),
      businessLineId: defaultLineId,
      contactId: "",
      occurredAt: occurredAtForDate(today, today),
      note: "",
      items: [],
    },
  });

  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
    // Sin esto, `useFieldArray` pisaría nuestro `id` con el suyo.
    keyName: "_key",
  });

  const [names, setNames] = useState<Record<string, PurchaseLineNames>>({});
  const [supplier, setSupplier] = useState<Contact | null>(null);
  const [date, setDate] = useState(today);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const businessLineId = useWatch({ control, name: "businessLineId" });
  const currentItems = useWatch({ control, name: "items" });

  const editorLines: PurchaseEditorLine[] = fields.map((field, index) => {
    const line = currentItems?.[index] ?? field;
    return {
      id: line.id,
      itemId: line.itemId,
      variantId: line.variantId || null,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    };
  });

  function addLine(line: PurchaseEditorLine, displayNames: PurchaseLineNames) {
    append({ ...line, variantId: line.variantId ?? "" });
    setNames((previous) => ({ ...previous, [line.id]: displayNames }));
  }

  /**
   * Campo a campo con `setValue` y no con el `update` de `useFieldArray`:
   * `update` vuelve a montar la fila y el cursor saltaría en cada tecla.
   */
  function updateLine(index: number, patch: Partial<PurchaseEditorLine>) {
    if (patch.quantity !== undefined) {
      setValue(`items.${index}.quantity`, patch.quantity, { shouldDirty: true });
    }
    if (patch.unitPrice !== undefined) {
      setValue(`items.${index}.unitPrice`, patch.unitPrice, { shouldDirty: true });
    }
  }

  const submit = handleSubmit(async (parsed) => {
    setError(null);
    const result = await createPurchase(parsed);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    const file = files[0];
    if (file) {
      void enqueue(result.expenseId, file, { onDone: () => router.refresh() });
    }

    reset(getValues());
    router.push("/expenses");
  });

  return (
    <MainContainer
      title="Nueva compra"
      description="Proveedor y al menos un insumo con cantidad y precio."
    >
      <form data-testid="purchase-form" className="flex flex-col gap-4" onSubmit={submit}>
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>No se pudo guardar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Insumos</CardTitle>
            </CardHeader>
            <CardContent>
              <PurchaseLinesTable
                lines={editorLines}
                names={names}
                supplies={supplies}
                businessLineId={businessLineId || null}
                hints={hints}
                timezone={timezone}
                disabled={isSubmitting}
                error={errors.items?.message ?? errors.items?.root?.message}
                lineErrors={lineIssuesOf(errors.items)}
                onAdd={addLine}
                onUpdate={updateLine}
                onRemove={remove}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos de la compra</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field data-invalid={errors.contactId ? true : undefined}>
                <ContactCombobox
                  contacts={suppliers}
                  role="supplier"
                  label="Proveedor"
                  value={supplier}
                  onSelect={(contact) => {
                    setSupplier(contact);
                    setValue("contactId", contact.id, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                />
                {errors.contactId && (
                  <FieldError data-testid="supplier-error">{errors.contactId.message}</FieldError>
                )}
              </Field>

              <Field data-invalid={errors.businessLineId ? true : undefined}>
                <FieldLabel htmlFor="purchase-line">Línea de negocio</FieldLabel>
                <Select
                  value={businessLineId || undefined}
                  disabled={isSubmitting}
                  onValueChange={(value) =>
                    setValue("businessLineId", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger
                    id="purchase-line"
                    data-testid="line-select"
                    aria-invalid={errors.businessLineId ? true : undefined}
                  >
                    <SelectValue placeholder="Elige una línea" />
                  </SelectTrigger>
                  <SelectContent>
                    {lines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.businessLineId && (
                  <FieldError data-testid="line-error">{errors.businessLineId.message}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="purchase-date">Fecha</FieldLabel>
                <Input
                  id="purchase-date"
                  type="date"
                  value={date}
                  max={today}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    const next = event.target.value || today;
                    setDate(next);
                    setValue("occurredAt", occurredAtForDate(next, today), {
                      shouldDirty: true,
                    });
                  }}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="purchase-note">Nota (opcional)</FieldLabel>
                <Textarea
                  id="purchase-note"
                  rows={2}
                  disabled={isSubmitting}
                  {...register("note")}
                />
              </Field>

              <ReceiptField value={files} onChange={setFiles} disabled={isSubmitting} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <DiscardGuard dirty={isDirty || files.length > 0} />
          <Button type="submit" disabled={isSubmitting} data-testid="save-purchase">
            Guardar
          </Button>
        </div>
      </form>
    </MainContainer>
  );
}
