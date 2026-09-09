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
import { useOnlineStatus } from "@/hooks/use-online-status";
import { countAdjustment } from "@/lib/inventory/count";
import { countSchema } from "@/lib/inventory/schema";
import { useOrganizationStore } from "@/stores/organization-store";
import { useUserStore } from "@/stores/user-store";
import type { Item } from "@/types";

import { captureAdjustment } from "./sync/capture-movement";

/**
 * Ajuste por conteo físico (V11, en diálogo — mapa §5).
 *
 * **Pregunta una sola cosa: cuánto hay.** No pide motivo, ni justificación, ni
 * categoría de merma, y esa ausencia es la funcionalidad: pedir una
 * explicación es la forma más segura de que nadie ajuste nunca y el saldo se
 * aleje para siempre de la realidad (criterio nº 4 del backlog).
 *
 * La diferencia se calcula **aquí y ahora** (design D6), y es la diferencia lo
 * que viaja. Si este ajuste se sincroniza dos horas más tarde y alguien
 * registró un consumo entre medias, los dos hechos sobreviven; guardando «pon
 * el saldo en 57» el consumo intermedio desaparecería sin dejar rastro.
 */
export function CountDialog({
  open,
  onOpenChange,
  item,
  balance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item;
  /** El saldo derivado en el momento de contar. */
  balance: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const organizationId = useOrganizationStore((state) => state.organization?.id);
  const userId = useUserStore((state) => state.user?.id);
  const { isOnline, reportSendResult } = useOnlineStatus();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    if (!organizationId || !userId) {
      setError("Tu sesión terminó. Vuelve a entrar.");
      return;
    }

    const counted = Number(String(data.get("countedQuantity") ?? ""));
    if (!Number.isFinite(counted) || counted < 0) {
      setError("El conteo no puede ser negativo");
      return;
    }

    const outcome = countAdjustment(counted, balance);

    // Un conteo que coincide con el saldo no es un fallo: es la respuesta
    // correcta y frecuente. La base rechazaría un movimiento de cantidad cero,
    // así que ni se intenta.
    if (outcome.status === "unchanged") {
      setError(null);
      setNotice("El conteo coincide con el saldo: no hay nada que ajustar.");
      return;
    }

    const parsed = countSchema.safeParse({
      id: crypto.randomUUID(),
      itemId: item.id,
      difference: outcome.difference,
      note: String(data.get("note") ?? ""),
      occurredAt: new Date().toISOString(),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await captureAdjustment(parsed.data, {
        organizationId,
        userId,
        isOnline: () => isOnline,
      });

      reportSendResult(result.status !== "queued");

      if (result.status === "failed") {
        setError(result.message);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <form onSubmit={submit} data-testid="count-form">
          <DialogHeader>
            <DialogTitle>Ajuste por conteo</DialogTitle>
            <DialogDescription>
              Cuenta lo que hay de {item.name} y escribe el número. El sistema
              anota la diferencia.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>No se pudo registrar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert className="mt-4" data-testid="count-unchanged">
              <AlertTitle>Todo cuadra</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel htmlFor="count-quantity">Cantidad contada</FieldLabel>
              <Input
                id="count-quantity"
                name="countedQuantity"
                inputMode="decimal"
                autoFocus
                required
              />
              <FieldDescription>
                El saldo actual es {balance}. No hace falta explicar la
                diferencia.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="count-note">Nota</FieldLabel>
              <Input id="count-note" name="note" />
              <FieldDescription>Opcional.</FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar conteo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
