"use client";

import { useEffect, useState } from "react";

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
import { Label } from "@/components/ui/label";
import { findLostChecklistItems } from "@/lib/ai/checklist-diff";
import { MarkdownView } from "@/lib/markdown/markdown-view";

export type ImproveBodyDialogProps = {
  /** El texto actual del borrador, no el guardado: se mejora lo que se ve. */
  currentBody: string;
  /** Se cierra el diálogo, al descartar o al pulsar fuera / Escape. */
  onClose: () => void;
  /** Se cierra el diálogo al aceptar: el llamador decide qué hacer con el texto. */
  onAccept: (proposal: string) => void;
  /** La acción de servidor, inyectada como el resto de este editor (`onSave`, `onToggleChecklistItem`). */
  onPropose: (body: string) => Promise<{ error: string } | { proposal: string }>;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; proposal: string };

/**
 * El panel de comparación de *Mejorar la descripción* (KAM-30).
 *
 * Pide la propuesta al montarse y la muestra junto al texto actual: nada se
 * escribe en el borrador hasta que la persona pulsa *Aceptar* (spec
 * `ai-writing-assist` → "Una propuesta nunca reemplaza el texto sin una
 * decisión explícita").
 *
 * El llamador lo monta y lo desmonta según `improving` en vez de pasarle un
 * `open` — así cada apertura nace con su propio estado, sin necesitar
 * reiniciarlo desde un efecto.
 */
export function ImproveBodyDialog({
  currentBody,
  onClose,
  onAccept,
  onPropose,
}: ImproveBodyDialogProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const result = await onPropose(currentBody);
        if (cancelled) return;

        if ("error" in result) {
          setState({ status: "error", message: result.error });
        } else {
          setState({ status: "ready", proposal: result.proposal });
        }
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudo generar la propuesta. Intenta de nuevo.",
          });
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lostItems =
    state.status === "ready" ? findLostChecklistItems(currentBody, state.proposal) : [];
  const needsAcknowledgement = lostItems.length > 0 && !warningAcknowledged;

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mejorar la descripción</DialogTitle>
          <DialogDescription>
            La propuesta se genera con un modelo de lenguaje externo. Nada se
            guarda hasta que la aceptas.
          </DialogDescription>
        </DialogHeader>

        {state.status === "loading" && (
          <p className="text-muted-foreground py-6 text-center text-sm" role="status">
            Generando la propuesta…
          </p>
        )}

        {state.status === "error" && (
          <Alert variant="destructive" data-testid="improve-body-error">
            <AlertTitle>No se pudo generar la propuesta</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {state.status === "ready" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium">Texto actual</p>
                <div className="rounded-md border p-3">
                  <MarkdownView>{currentBody}</MarkdownView>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium">Propuesta</p>
                <div className="rounded-md border p-3" data-testid="improve-body-proposal">
                  <MarkdownView>{state.proposal}</MarkdownView>
                </div>
              </div>
            </div>

            {lostItems.length > 0 && (
              <Alert variant="destructive" data-testid="checklist-loss-warning">
                <AlertTitle>La propuesta pierde ítems de verificación</AlertTitle>
                <AlertDescription>
                  <p>
                    Estos ítems del texto actual no aparecen en la propuesta:{" "}
                    {lostItems.join(", ")}.
                  </p>
                  <div className="mt-2 flex items-start gap-2">
                    <Checkbox
                      id="acknowledge-checklist-loss"
                      checked={warningAcknowledged}
                      onCheckedChange={(checked) => setWarningAcknowledged(checked === true)}
                    />
                    <Label htmlFor="acknowledge-checklist-loss" className="font-normal">
                      Entiendo que se perderían y quiero aceptar igual.
                    </Label>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Descartar
          </Button>
          {state.status === "ready" && (
            <Button
              type="button"
              disabled={needsAcknowledgement}
              onClick={() => onAccept(state.proposal)}
            >
              Aceptar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
