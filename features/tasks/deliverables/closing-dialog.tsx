"use client";

import { useState, useTransition } from "react";

import { closeTaskWithDeliverables } from "@/actions/tasks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DELIVERABLE_DEFINITIONS,
  pendingDeliverables,
  prefillFor,
  type Deliverable,
  type DeliverablePrefill,
  type DeliverableType,
  type TaskContext,
} from "@/lib/tasks/deliverables";

export type ClosingDialogProps = {
  open: boolean;
  taskId: string;
  /** El estado de tipo `final` al que se lleva la tarea. */
  statusId: string;
  task: TaskContext;
  deliverables: Deliverable[];
  /** Lo que los formularios de egreso necesitan y la tarea no sabe. */
  suppliers: { id: string; name: string }[];
  expenseCategories: { id: string; name: string }[];
  supplies: { id: string; name: string }[];
  /** Se cierra el diálogo sin haber cerrado la tarea (supuesto 6). */
  onCancel: () => void;
  onClosed: () => void;
};

type EntryState = {
  type: DeliverableType;
  newId: string;
  included: boolean;
  prefill: DeliverablePrefill;
  /** Qué adjuntos de la tarea viajan al registro creado. */
  attachmentIds: string[];
};

/**
 * V19 · El asistente de cierre con entregables.
 *
 * Se abre al llevar la tarea a un estado de tipo `final` **solo si** queda algo
 * declarado sin cumplir. Una tarea sin entregables se cierra sin ver esto.
 *
 * Las tres salidas son legítimas y ninguna se penaliza:
 *
 *   · *Crear seleccionados y cerrar* crea lo marcado y cierra.
 *   · *Cerrar sin crear nada* cierra sin crear, sin pedir justificación y sin
 *     advertir. Deja una marca discreta, localizable por filtro, y nada más.
 *   · *Cancelar* deja la tarea como estaba: ni cerrada, ni movida.
 *
 * Todo lo prellenado es una propuesta: se puede corregir antes de crear, y
 * cada entregable se incluye o no por separado.
 */
export function ClosingDialog({
  open,
  taskId,
  statusId,
  task,
  deliverables,
  suppliers,
  expenseCategories,
  supplies,
  onCancel,
  onClosed,
}: ClosingDialogProps) {
  const pendingList = pendingDeliverables(deliverables);

  const [entries, setEntries] = useState<EntryState[]>(() =>
    pendingList.map((deliverable) => {
      const prefill = prefillFor(deliverable.deliverableType, task);
      return {
        type: deliverable.deliverableType,
        // Se genera aquí porque la ruta de Storage lo necesita antes de que la
        // fila exista (design D3). La convención nº 9 ya admite UUID de fuera.
        newId: crypto.randomUUID(),
        included: true,
        prefill,
        attachmentIds: prefill.attachmentIds,
      };
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  function update(type: DeliverableType, patch: Partial<EntryState>) {
    setEntries((current) =>
      current.map((entry) =>
        entry.type === type ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function submit(includeSelected: boolean) {
    setError(null);
    const chosen = includeSelected
      ? entries.filter((entry) => entry.included)
      : [];

    startTransition(async () => {
      const result = await closeTaskWithDeliverables({
        taskId,
        statusId,
        deliverables: chosen.map((entry) => ({
          type: entry.type,
          newId: entry.newId,
          payload: toPayload(entry),
          attachmentIds: entry.attachmentIds,
        })),
      });

      if (result?.error) {
        setError(result.error);
        return;
      }
      onClosed();
    });
  }

  const selected = entries.filter((entry) => entry.included).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        data-testid="closing-dialog"
      >
        <DialogHeader>
          <DialogTitle>Cerrar la tarea</DialogTitle>
          <DialogDescription>
            Esta tarea esperaba crear{" "}
            {pendingList.length === 1 ? "un registro" : "estos registros"}.
            Puedes crearlos todos, algunos o ninguno.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>No se pudo cerrar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <section
              key={entry.type}
              className="flex flex-col gap-3 rounded-md border p-3"
              data-testid={`deliverable-form-${entry.type}`}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`include-${entry.type}`}
                  checked={entry.included}
                  disabled={saving}
                  onCheckedChange={(checked) =>
                    update(entry.type, { included: checked === true })
                  }
                />
                <Label htmlFor={`include-${entry.type}`} className="font-medium">
                  {DELIVERABLE_DEFINITIONS[entry.type].label}
                </Label>
              </div>

              {/* Los campos solo se montan si el entregable va a crearse: los
                  cinco formularios completos a la vez son peso que casi nunca
                  se usa, y en un diálogo de móvil se nota (design D7). */}
              {entry.included && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`name-${entry.type}`}>
                      {entry.type === "purchase" || entry.type === "expenses"
                        ? "Descripción"
                        : "Nombre"}
                    </Label>
                    <Input
                      id={`name-${entry.type}`}
                      value={entry.prefill.name}
                      disabled={saving}
                      onChange={(event) =>
                        update(entry.type, {
                          prefill: { ...entry.prefill, name: event.target.value },
                        })
                      }
                    />
                  </div>

                  {/* Un gasto exige categoría e importe: `create_expense`
                      los rechaza vacíos, y la tarea no los sabe. */}
                  {entry.type === "expenses" && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`amount-${entry.type}`}>Importe</Label>
                        <Input
                          id={`amount-${entry.type}`}
                          inputMode="decimal"
                          value={entry.prefill.amount ?? ""}
                          disabled={saving}
                          onChange={(event) =>
                            update(entry.type, {
                              prefill: {
                                ...entry.prefill,
                                amount: event.target.value,
                              },
                            })
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`category-${entry.type}`}>Categoría</Label>
                        <Select
                          value={entry.prefill.expenseCategoryId ?? ""}
                          disabled={saving}
                          onValueChange={(value) =>
                            update(entry.type, {
                              prefill: {
                                ...entry.prefill,
                                expenseCategoryId: value,
                              },
                            })
                          }
                        >
                          <SelectTrigger id={`category-${entry.type}`}>
                            <SelectValue placeholder="Elige una categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Una compra exige proveedor y al menos una línea. */}
                  {entry.type === "purchase" && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`supplier-${entry.type}`}>Proveedor</Label>
                        <Select
                          value={entry.prefill.contactId ?? ""}
                          disabled={saving}
                          onValueChange={(value) =>
                            update(entry.type, {
                              prefill: { ...entry.prefill, contactId: value },
                            })
                          }
                        >
                          <SelectTrigger id={`supplier-${entry.type}`}>
                            <SelectValue placeholder="Elige un proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <PurchaseLine
                        supplies={supplies}
                        disabled={saving}
                        line={entry.prefill.items?.[0] ?? null}
                        onChange={(line) =>
                          update(entry.type, {
                            prefill: { ...entry.prefill, items: [line] },
                          })
                        }
                      />
                    </>
                  )}

                  {entry.type === "asset" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`cost-${entry.type}`}>
                        Costo de adquisición
                      </Label>
                      <Input
                        id={`cost-${entry.type}`}
                        inputMode="decimal"
                        value={entry.prefill.acquisitionCost ?? ""}
                        disabled={saving}
                        onChange={(event) =>
                          update(entry.type, {
                            prefill: {
                              ...entry.prefill,
                              acquisitionCost: event.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`notes-${entry.type}`}>Notas</Label>
                    <Textarea
                      id={`notes-${entry.type}`}
                      rows={3}
                      value={entry.prefill.notes ?? ""}
                      disabled={saving}
                      onChange={(event) =>
                        update(entry.type, {
                          prefill: {
                            ...entry.prefill,
                            notes: event.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  {task.attachments.length > 0 && (
                    <fieldset className="flex flex-col gap-1.5">
                      <legend className="text-sm font-medium">
                        Adjuntos que se llevan
                      </legend>
                      {task.attachments.map((attachment) => (
                        <label
                          key={attachment.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={entry.attachmentIds.includes(attachment.id)}
                            disabled={saving}
                            onCheckedChange={(checked) =>
                              update(entry.type, {
                                attachmentIds:
                                  checked === true
                                    ? [...entry.attachmentIds, attachment.id]
                                    : entry.attachmentIds.filter(
                                        (id) => id !== attachment.id,
                                      ),
                              })
                            }
                          />
                          {attachment.fileName}
                        </label>
                      ))}
                    </fieldset>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
          {/* Sin advertencia y sin justificación: es una salida legítima. */}
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => submit(false)}
          >
            Cerrar sin crear nada
          </Button>
          <Button
            disabled={saving || selected === 0}
            onClick={() => submit(true)}
          >
            Crear seleccionados y cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lo que cada tipo manda a la RPC, según lo que su destino necesita. */
function toPayload(entry: EntryState): Record<string, unknown> {
  const { prefill } = entry;

  switch (entry.type) {
    case "product":
    case "supply":
      return {
        name: prefill.name,
        business_line_id: prefill.businessLineId,
        description: prefill.notes,
      };
    case "asset":
      return {
        name: prefill.name,
        business_line_id: prefill.businessLineId,
        description: prefill.notes,
        acquisition_cost: prefill.acquisitionCost ?? "0",
        notes: prefill.notes,
      };
    case "supplier":
      return { name: prefill.name, notes: prefill.notes };
    case "purchase":
      return {
        business_line_id: prefill.businessLineId,
        note: prefill.name,
        contact_id: prefill.contactId,
        items: (prefill.items ?? []).map((line) => ({
          item_id: line.itemId,
          quantity: line.quantity,
          unit_price: line.unitPrice,
        })),
      };
    case "expenses":
      return {
        business_line_id: prefill.businessLineId,
        note: prefill.name,
        amount: prefill.amount,
        expense_category_id: prefill.expenseCategoryId,
        items: [],
      };
  }
}

/**
 * La línea de una compra dentro del asistente.
 *
 * Una sola, deliberadamente: `create_expense` exige al menos una, y una compra
 * de varias líneas es trabajo del formulario completo (V8), no de un diálogo
 * de cierre. Quien necesite más entra a editarla después.
 */
function PurchaseLine({
  supplies,
  line,
  disabled,
  onChange,
}: {
  supplies: { id: string; name: string }[];
  line: { itemId: string; quantity: string; unitPrice: string } | null;
  disabled: boolean;
  onChange: (line: { itemId: string; quantity: string; unitPrice: string }) => void;
}) {
  const current = line ?? { itemId: "", quantity: "1", unitPrice: "" };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Qué se compró</legend>

      <Select
        value={current.itemId}
        disabled={disabled}
        onValueChange={(value) => onChange({ ...current, itemId: value })}
      >
        <SelectTrigger aria-label="Insumo comprado">
          <SelectValue placeholder="Elige un insumo" />
        </SelectTrigger>
        <SelectContent>
          {supplies.map((supply) => (
            <SelectItem key={supply.id} value={supply.id}>
              {supply.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="purchase-quantity">Cantidad</Label>
          <Input
            id="purchase-quantity"
            inputMode="decimal"
            value={current.quantity}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...current, quantity: event.target.value })
            }
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="purchase-price">Precio unitario</Label>
          <Input
            id="purchase-price"
            inputMode="decimal"
            value={current.unitPrice}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...current, unitPrice: event.target.value })
            }
          />
        </div>
      </div>
    </fieldset>
  );
}
