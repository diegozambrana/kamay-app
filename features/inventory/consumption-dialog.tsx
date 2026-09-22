"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { consumptionSchema } from "@/lib/inventory/schema";
import { movementVariantProblem } from "@/lib/inventory/variants";
import { useOrganizationStore } from "@/stores/organization-store";
import { useUserStore } from "@/stores/user-store";
import type { Item, ItemVariant } from "@/types";

/** Un insumo con sus variantes vigentes: lo que ofrece el registro rápido. */
export type ConsumableSupply = Item & { variants?: ItemVariant[] };

import { captureConsumption } from "./sync/capture-movement";

/**
 * Registrar un consumo (V16 · destino *Consumo*, V11 y el diálogo desde un
 * pedido o una tarea).
 *
 * **Es un diálogo, no una pantalla** (mapa §5): registrar un consumo no puede
 * sacar a nadie de donde estaba. Desde el detalle de un insumo, el insumo
 * viene puesto y la operación son dos interacciones —escribir la cantidad y
 * confirmar—; desde la retícula de registro rápido son tres, porque además
 * hay que elegir el insumo.
 *
 * Todo consumo se guarda con origen `manual`, venga de donde venga (design
 * D5). Lo que cambia según el punto de entrada es la **nota**, que llega
 * prellenada con la referencia y es modificable.
 *
 * Un insumo con variantes exige elegir cuál (`catalog-custom-attributes`,
 * design D7): desde la fila de una variante viene puesta y siguen siendo dos
 * interacciones; si no, se elige con un toque entre sus variantes vigentes.
 */
export function ConsumptionDialog({
  open,
  onOpenChange,
  supplies,
  item,
  variants,
  variant,
  defaultNote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Los insumos elegibles, con sus variantes. Se ignora cuando `item` viene puesto. */
  supplies?: ConsumableSupply[];
  /** El insumo, cuando el punto de entrada ya lo conoce. */
  item?: Item;
  /** Las variantes vigentes de `item`, cuando viene puesto. */
  variants?: ItemVariant[];
  /** La variante, cuando se abre desde su fila en el detalle. */
  variant?: ItemVariant;
  /** Prellenada con la referencia del pedido o de la tarea de origen. */
  defaultNote?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const organizationId = useOrganizationStore((state) => state.organization?.id);
  const userId = useUserStore((state) => state.user?.id);
  const { isOnline, reportSendResult } = useOnlineStatus();
  const [chosenItemId, setChosenItemId] = useState("");
  const [chosenVariantId, setChosenVariantId] = useState("");

  const itemId = item?.id ?? chosenItemId;
  const itemVariants = (
    item ? (variants ?? []) : (supplies?.find((supply) => supply.id === itemId)?.variants ?? [])
  ).filter((candidate) => candidate.archivedAt === null);
  const variantId = variant?.id ?? (chosenVariantId || null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    if (!organizationId || !userId) {
      setError("Tu sesión terminó. Vuelve a entrar.");
      return;
    }

    // La misma regla que aplica el servidor, avisada antes de enviar.
    const variantProblem = variant ? null : movementVariantProblem(itemVariants, variantId);
    if (itemId && variantProblem) {
      setError(variantProblem);
      return;
    }

    const parsed = consumptionSchema.safeParse({
      // Identificador generado en el cliente (convención nº 9): el reintento
      // reenvía el mismo y la clave primaria impide el segundo movimiento.
      id: crypto.randomUUID(),
      itemId,
      variantId,
      quantity: String(data.get("quantity") ?? ""),
      note: String(data.get("note") ?? ""),
      // La hora del hecho es la de registrar, no la de abrir el diálogo: sin
      // red esta es la única hora que habrá.
      occurredAt: new Date().toISOString(),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await captureConsumption(parsed.data, {
        organizationId,
        userId,
        isOnline: () => isOnline,
      });

      // Lo que acaba de pasar es mejor evidencia de conectividad que
      // `navigator.onLine`, que en una WiFi sin salida sigue diciendo que sí.
      reportSendResult(result.status !== "queued");

      if (result.status === "failed") {
        setError(result.message);
        return;
      }

      // Encolado cuenta como registrado: la cola se encarga del resto y la
      // interfaz no puede quedarse esperando a una red que no está.
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <form onSubmit={submit} data-testid="consumption-form">
          <DialogHeader>
            <DialogTitle>Registrar consumo</DialogTitle>
            <DialogDescription>
              {item
                ? `Cuánto se usó de ${item.name}${variant ? ` · ${variant.name}` : ""}.`
                : "Qué insumo se usó y cuánto."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>No se pudo registrar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FieldGroup className="mt-4">
            {!item && (
              <Field>
                <FieldLabel htmlFor="consumption-item">Insumo</FieldLabel>
                <Select
                  name="itemId"
                  required
                  value={chosenItemId}
                  onValueChange={(value) => {
                    setChosenItemId(value);
                    // La variante elegida era de otro insumo.
                    setChosenVariantId("");
                  }}
                >
                  <SelectTrigger id="consumption-item">
                    <SelectValue placeholder="Elige un insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(supplies ?? []).map((supply) => (
                      <SelectItem key={supply.id} value={supply.id}>
                        {supply.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {!variant && itemVariants.length > 0 && (
              <Field>
                <FieldLabel id="consumption-variant-label">Variante</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={chosenVariantId}
                  onValueChange={setChosenVariantId}
                  aria-labelledby="consumption-variant-label"
                  className="flex-wrap justify-start"
                  data-testid="consumption-variant"
                >
                  {itemVariants.map((candidate) => (
                    <ToggleGroupItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription>De cuál se usó.</FieldDescription>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="consumption-quantity">Cantidad</FieldLabel>
              <Input
                id="consumption-quantity"
                name="quantity"
                inputMode="decimal"
                autoFocus
                required
              />
              <FieldDescription>Cuánto salió del estante.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="consumption-note">Nota</FieldLabel>
              <Input
                id="consumption-note"
                name="note"
                defaultValue={defaultNote ?? ""}
              />
              <FieldDescription>Opcional. Para qué se usó.</FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Registrando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
