"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { createExpense } from "@/actions/expenses";
import { MainContainer } from "@/components/layout/main-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { DiscardGuard } from "@/features/orders/discard-guard";
import { occurredAtForDate } from "@/lib/expenses/period";
import {
  costFormSchema,
  type CostFormInput,
  type CostFormValues,
} from "@/lib/expenses/schema";
import type { BusinessLine, ExpenseCategory } from "@/types";

import { CategoryChips } from "./category-chips";
import { ReceiptField } from "./receipt-field";
import { useReceiptUploadStore } from "./receipt-upload-store";

/** Un pedido vigente, para "asignar a un pedido". */
export type AssignableOrder = { id: string; code: number; label: string };

/**
 * V9 · Nuevo gasto. Deliberadamente corto (design D5): monto con el foco,
 * categorías como chips, línea heredada del selector global, hoy por defecto.
 * Desde la bandeja: abrir, escribir el monto, tocar una categoría, guardar.
 *
 * El comprobante se encola DESPUÉS de guardar: el gasto nunca espera a la
 * foto (design D4).
 */
export function CostForm({
  defaultLineId,
  lines,
  categories,
  orders,
  today,
}: {
  /** La línea activa, o la compartida cuando el contexto es "Todas". */
  defaultLineId: string;
  lines: BusinessLine[];
  categories: ExpenseCategory[];
  orders: AssignableOrder[];
  /** Hoy, en la zona horaria de la organización (`YYYY-MM-DD`). */
  today: string;
}) {
  const router = useRouter();
  const enqueue = useReceiptUploadStore((state) => state.enqueue);

  const form = useForm<CostFormInput, unknown, CostFormValues>({
    resolver: zodResolver(costFormSchema),
    defaultValues: {
      // Generado en el cliente (convención nº 9).
      id: crypto.randomUUID(),
      businessLineId: defaultLineId,
      expenseCategoryId: "",
      amount: "",
      occurredAt: occurredAtForDate(today, today),
      note: "",
      orderId: "",
    },
  });

  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    register,
    reset,
    getValues,
    setValue,
  } = form;

  const [date, setDate] = useState(today);
  const [files, setFiles] = useState<File[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const businessLineId = useWatch({ control, name: "businessLineId" });
  const expenseCategoryId = useWatch({ control, name: "expenseCategoryId" });
  const orderId = useWatch({ control, name: "orderId" });

  const submit = handleSubmit(async (parsed) => {
    setError(null);
    const result = await createExpense(parsed);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    // Guardar primero, subir después: la bandeja ya muestra el gasto mientras
    // el comprobante viaja en segundo plano.
    const file = files[0];
    if (file) {
      void enqueue(result.expenseId, file, { onDone: () => router.refresh() });
    }

    // Limpia `isDirty` antes de navegar: la guardia no debe preguntar.
    reset(getValues());
    router.push("/expenses");
  });

  return (
    <MainContainer
      title="Nuevo gasto"
      description="Monto y categoría. Todo lo demás puede esperar."
    >
      <form
        data-testid="cost-form"
        className="mx-auto flex w-full max-w-lg flex-col gap-5"
        onSubmit={submit}
      >
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>No se pudo guardar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* El monto manda: grande, con el foco y teclado numérico. */}
        <Field data-invalid={errors.amount ? true : undefined}>
          <FieldLabel htmlFor="cost-amount">Monto</FieldLabel>
          <Input
            id="cost-amount"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            autoFocus
            placeholder="0.00"
            className="h-14 text-3xl font-semibold tabular-nums"
            aria-invalid={errors.amount ? true : undefined}
            disabled={isSubmitting}
            {...register("amount")}
          />
          {errors.amount && (
            <FieldError data-testid="amount-error">{errors.amount.message}</FieldError>
          )}
        </Field>

        <CategoryChips
          categories={categories}
          value={expenseCategoryId ?? ""}
          disabled={isSubmitting}
          error={errors.expenseCategoryId?.message}
          onChange={(categoryId) =>
            setValue("expenseCategoryId", categoryId, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={errors.businessLineId ? true : undefined}>
            <FieldLabel htmlFor="cost-line">Línea de negocio</FieldLabel>
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
                id="cost-line"
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
            <FieldLabel htmlFor="cost-date">Fecha</FieldLabel>
            <Input
              id="cost-date"
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
        </div>

        <Field>
          <FieldLabel htmlFor="cost-note">Nota (opcional)</FieldLabel>
          <Textarea
            id="cost-note"
            rows={2}
            placeholder="Taxi al proveedor, internet del mes…"
            disabled={isSubmitting}
            {...register("note")}
          />
        </Field>

        <ReceiptField value={files} onChange={setFiles} disabled={isSubmitting} />

        {/* Plegado por defecto: no cuesta ninguna interacción si no se usa. */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
            data-testid="assign-order-toggle"
            aria-expanded={assigning}
            onClick={() => setAssigning((open) => !open)}
          >
            <ChevronDownIcon
              className={`size-4 transition-transform ${assigning ? "rotate-180" : ""}`}
              aria-hidden
            />
            Asignar a un pedido
          </button>

          {assigning && (
            <Field>
              <FieldLabel htmlFor="cost-order">Pedido</FieldLabel>
              <Select
                value={orderId || undefined}
                disabled={isSubmitting}
                onValueChange={(value) =>
                  setValue("orderId", value, { shouldDirty: true })
                }
              >
                <SelectTrigger id="cost-order" data-testid="order-select">
                  <SelectValue placeholder="Elige un pedido" />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <DiscardGuard dirty={isDirty || files.length > 0} />
          <Button type="submit" disabled={isSubmitting} data-testid="save-cost">
            Guardar
          </Button>
        </div>
      </form>
    </MainContainer>
  );
}
