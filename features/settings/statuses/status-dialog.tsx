"use client";

import { createStatus, updateStatus } from "@/actions/statuses";
import { FormDialog, type EntityDialog } from "@/components/shared/form-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_KIND_LABELS } from "@/lib/statuses/kinds";
import { setIsComplete, statusFormSchema } from "@/lib/statuses/schema";
import { STATUS_KINDS, type Status, type StatusFlow } from "@/types";

import { ColorSelect } from "../color-select";

export const INCOMPLETE_SET = "Todo juego necesita al menos un estado inicial y uno final.";

/**
 * Agregar o editar un estado de V22 (spec `configurable-statuses`). La
 * validación del juego —al menos un inicial y un final— se comprueba aquí
 * antes de enviar; la base la garantiza después. Si no pasa, el diálogo se
 * queda abierto con lo escrito y el aviso dentro.
 */
export function StatusDialog({
  dialog,
  active,
  businessLineId,
  flow,
}: {
  dialog: EntityDialog<Status>;
  /** Los estados activos del juego, incluido el que se edita. */
  active: Status[];
  businessLineId: string | null;
  flow: StatusFlow;
}) {
  const status = dialog.target;

  return (
    <FormDialog
      open={dialog.open}
      onOpenChange={dialog.onOpenChange}
      title={status ? `Editar «${status.name}»` : "Agregar estado"}
      submitLabel={status ? "Guardar cambios" : "Agregar estado"}
      pending={dialog.pending}
      error={dialog.error}
      data-testid="status-dialog"
      onSubmit={(data) => {
        const parsed = statusFormSchema.safeParse({
          name: String(data.get("name") ?? ""),
          color: String(data.get("color") ?? "zinc"),
          kind: String(data.get("kind") ?? "in_progress"),
          isQueue: data.get("isQueue") === "on",
        });
        if (!parsed.success) {
          dialog.setError(parsed.error.issues[0].message);
          return;
        }

        const siblings = active.filter((candidate) => candidate.id !== status?.id);
        if (!setIsComplete([...siblings.map((sibling) => sibling.kind), parsed.data.kind])) {
          dialog.setError(INCOMPLETE_SET);
          return;
        }

        dialog.submit(() =>
          status
            ? updateStatus({ ...parsed.data, id: status.id })
            : createStatus({ businessLineId, flow, ...parsed.data }),
        );
      }}
    >
      <Field>
        <FieldLabel htmlFor="status-name">Nombre</FieldLabel>
        <Input
          id="status-name"
          name="name"
          defaultValue={status?.name ?? ""}
          autoComplete="off"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="status-kind">Tipo</FieldLabel>
          <Select name="kind" defaultValue={status?.kind ?? "in_progress"}>
            <SelectTrigger id="status-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {STATUS_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="status-color">Color</FieldLabel>
          <ColorSelect id="status-color" name="color" defaultValue={status?.color ?? "zinc"} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isQueue" defaultChecked={status?.isQueue ?? false} />
        Columna en cola
      </label>
    </FormDialog>
  );
}
