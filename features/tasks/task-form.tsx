"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { createTask, updateTaskFields } from "@/actions/tasks";
import { MainContainer } from "@/components/layout/main-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDiscardConfirm } from "@/features/orders/discard-guard";
import { originCrumb, withFrom } from "@/lib/tasks/list-href";
import type { TaskLinkType } from "@/types";
import type { BusinessLine, Tag } from "@/types";

import { TagPicker } from "./tag-picker";

export type TaskFormPrefill = {
  title?: string;
  businessLineId?: string;
  dueDate?: string | null;
  link?: { entityType: TaskLinkType; entityId: string } | null;
  /** Contexto visible: de qué pedido viene. No es un dato de la tarea. */
  linkLabel?: string | null;
  customerName?: string | null;
};

/** Los valores actuales de la tarea que se edita. */
export type TaskFormValues = {
  id: string;
  title: string;
  businessLineId: string;
  assigneeId: string | null;
  /** `YYYY-MM-DD`, como lo da el input nativo. */
  dueDate: string | null;
  /** ISO. Se recorta a minutos para `datetime-local`. */
  remindAt: string | null;
  tagNames: string[];
};

/**
 * El recordatorio cuelga de la fecha límite: es la regla que la base impone
 * con `reminder_needs_due_date`, dicha aquí para que la pantalla pueda
 * señalar el campo en vez de devolver un error de restricción.
 */
const schema = z
  .object({
    title: z.string().trim().min(1, "El título no puede quedar vacío."),
    businessLineId: z.string().min(1, "Elige una línea de negocio."),
    assigneeId: z.string(),
    dueDate: z.string(),
    remindAt: z.string(),
    tagNames: z.array(z.string()),
    keepLink: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.remindAt !== "" && values.dueDate === "") {
      ctx.addIssue({
        code: "custom",
        path: ["remindAt"],
        message:
          "Primero ponle una fecha límite a la tarea; el recordatorio cuelga de ella.",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

/** `datetime-local` no admite zona: se recorta a minutos. */
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((tag, index) => tag === right[index]);
}

/**
 * Formulario de tarea: alta y edición.
 *
 * **Alta.** Todo lo prellenado es una **propuesta**: la línea, la fecha y el
 * propio vínculo se pueden cambiar o quitar antes de guardar. La decisión de
 * crear la tarea, y con qué, es siempre de la persona — es la misma regla que
 * impide que un pedido genere tareas por su cuenta (convención nº 10).
 *
 * **Edición** (KAM-29). Reúne los datos que *describen* la tarea; lo que se
 * hace mientras se trabaja —estado, cuerpo, casillas, adjuntos, vínculos y
 * entregables— se queda en el detalle. Guarda **solo los campos que se
 * tocaron** (design D2): lo que este formulario no menciona no puede
 * sobrescribir lo que otra persona acaba de cambiar en el detalle, y la
 * bitácora registra exactamente los campos cambiados.
 */
export function TaskForm({
  mode = "create",
  task,
  lines,
  assignees,
  tags,
  currentUserId,
  prefill,
  from = null,
}: {
  mode?: "create" | "edit";
  /** Obligatorio en modo edición. */
  task?: TaskFormValues;
  lines: BusinessLine[];
  assignees: { userId: string; displayName: string | null }[];
  tags: Tag[];
  /** Obligatorio en modo alta: el responsable propuesto. */
  currentUserId?: string;
  prefill?: TaskFormPrefill;
  /** La vista de origen, para volver a donde se estaba (design D5). */
  from?: string | null;
}) {
  const router = useRouter();
  const editing = mode === "edit";
  const [error, setError] = useState<string | null>(null);

  const defaultValues: FormValues =
    editing && task
      ? {
          title: task.title,
          businessLineId: task.businessLineId,
          assigneeId: task.assigneeId ?? "",
          dueDate: task.dueDate ?? "",
          remindAt: toLocalInput(task.remindAt),
          tagNames: task.tagNames,
          keepLink: false,
        }
      : {
          title: prefill?.title ?? "",
          businessLineId: prefill?.businessLineId ?? lines[0]?.id ?? "",
          // El responsable propuesto es quien crea la tarea (§6.3).
          assigneeId: currentUserId ?? "",
          dueDate: prefill?.dueDate ?? "",
          remindAt: "",
          tagNames: [],
          keepLink: Boolean(prefill?.link),
        };

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  const { confirmHref, leave, dialog: discardDialog } = useDiscardConfirm(isDirty);

  const tagNames = useWatch({ control, name: "tagNames" });
  const keepLink = useWatch({ control, name: "keepLink" });
  const dueDate = useWatch({ control, name: "dueDate" });

  const detailHref = task ? withFrom(`/tasks/${task.id}`, from) : "/tasks";
  const listCrumb = originCrumb(from);

  async function submit(values: FormValues) {
    setError(null);

    if (editing && task) {
      /**
       * Solo los campos sucios (design D2). `undefined` en la acción quiere
       * decir «no tocar», así que lo que no se editó ni siquiera viaja.
       */
      const payload: Parameters<typeof updateTaskFields>[0] = { taskId: task.id };

      if (dirtyFields.title) payload.title = values.title;
      if (dirtyFields.businessLineId) payload.businessLineId = values.businessLineId;
      if (dirtyFields.assigneeId) payload.assigneeId = values.assigneeId || null;
      if (dirtyFields.dueDate) payload.dueDate = values.dueDate || null;
      if (dirtyFields.remindAt) {
        payload.remindAt = values.remindAt
          ? new Date(values.remindAt).toISOString()
          : null;
      }
      // Las etiquetas se comparan por su contenido: `dirtyFields` de un
      // arreglo dice poco cuando se quita una y se agrega otra.
      if (!sameTags(values.tagNames, task.tagNames)) payload.tagNames = values.tagNames;

      const result = await updateTaskFields(payload);

      if (result?.error) {
        setError(result.error);
        return;
      }

      // Limpia `isDirty` antes de navegar: la guardia de descarte no debe
      // preguntar por cambios que ya están guardados.
      reset(values);
      router.push(detailHref);
      return;
    }

    const result = await createTask({
      title: values.title,
      businessLineId: values.businessLineId,
      assigneeId: values.assigneeId || null,
      dueDate: values.dueDate || null,
      tagNames: values.tagNames,
      link: values.keepLink ? (prefill?.link ?? null) : null,
    });

    if ("error" in result) {
      setError(result.error);
      return;
    }

    reset(values);
    router.push("/tasks");
  }

  const form = (
    <form onSubmit={handleSubmit(submit)} className="flex max-w-xl flex-col gap-4">
      {error && (
        <Alert variant="destructive" data-testid="task-form-error">
          <AlertTitle>No se pudo guardar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Field>
        <FieldLabel htmlFor="task-title">Título</FieldLabel>
        <Input
          id="task-title"
          autoFocus
          disabled={isSubmitting}
          placeholder="¿Qué hay que hacer?"
          {...register("title")}
        />
        {errors.title && <FieldError>{errors.title.message}</FieldError>}
      </Field>

      <Field>
        <FieldLabel htmlFor="task-line">Línea de negocio</FieldLabel>
        <select
          id="task-line"
          disabled={isSubmitting}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
          {...register("businessLineId")}
        >
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.name}
            </option>
          ))}
        </select>
        {errors.businessLineId && (
          <FieldError>{errors.businessLineId.message}</FieldError>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="task-assignee">Responsable</FieldLabel>
        <select
          id="task-assignee"
          disabled={isSubmitting}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
          {...register("assigneeId")}
        >
          <option value="">Sin responsable</option>
          {assignees.map((person) => (
            <option key={person.userId} value={person.userId}>
              {person.displayName ?? "Sin nombre"}
            </option>
          ))}
        </select>
      </Field>

      <Field>
        <FieldLabel htmlFor="task-due">Fecha límite</FieldLabel>
        <Input
          id="task-due"
          type="date"
          disabled={isSubmitting}
          {...register("dueDate")}
        />
      </Field>

      {/* El recordatorio solo existe en la edición: el alta no lo tenía y no
          lo gana (design D6). */}
      {editing && (
        <Field>
          <FieldLabel htmlFor="task-remind">Recordatorio</FieldLabel>
          <Input
            id="task-remind"
            type="datetime-local"
            disabled={isSubmitting}
            {...register("remindAt")}
          />
          {errors.remindAt ? (
            <FieldError>{errors.remindAt.message}</FieldError>
          ) : (
            dueDate === "" && (
              <p className="text-muted-foreground text-xs">
                El recordatorio cuelga de la fecha límite.
              </p>
            )
          )}
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="task-tags">Etiquetas</FieldLabel>
        <TagPicker
          available={tags}
          value={tagNames}
          onChange={(next) => setValue("tagNames", next, { shouldDirty: true })}
          disabled={isSubmitting}
        />
      </Field>

      {/* El vínculo llega prellenado desde el pedido y se puede quitar: es una
          propuesta, no una imposición. En una tarea que ya existe los vínculos
          viven en el detalle, así que este bloque es solo del alta. */}
      {!editing && prefill?.link && (
        <div
          data-testid="task-link"
          className="rounded-lg border bg-muted/40 p-3 text-sm"
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={keepLink}
              disabled={isSubmitting}
              onChange={(event) =>
                setValue("keepLink", event.target.checked, { shouldDirty: true })
              }
            />
            Vincular con {prefill.linkLabel ?? "el pedido"}
          </label>
          {prefill.customerName && (
            <p className="mt-1 pl-6 text-xs text-muted-foreground">
              Cliente: {prefill.customerName}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} data-testid="save-task">
          {isSubmitting && <Spinner />}
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          data-testid="cancel-task"
          onClick={() => leave(() => router.push(editing ? detailHref : "/tasks"))}
        >
          Cancelar
        </Button>
      </div>

      {discardDialog}
    </form>
  );

  // En el alta las migas y el encabezado los pone la página; en la edición los
  // pone el formulario, porque la guardia de descarte tiene que interceptar
  // los tramos que salen de aquí.
  if (!editing || !task) return form;

  return (
    <MainContainer
      breadcrumbs={[
        {
          label: listCrumb.label,
          href: listCrumb.href,
          onClick: confirmHref(listCrumb.href),
        },
        {
          label: task.title,
          href: detailHref,
          onClick: confirmHref(detailHref),
        },
        { label: "Editar" },
      ]}
      title="Editar tarea"
    >
      {form}
    </MainContainer>
  );
}
