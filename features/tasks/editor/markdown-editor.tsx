"use client";

import {
  BoldIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListChecksIcon,
  PencilIcon,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDiscardConfirm } from "@/features/orders/discard-guard";
import { type ToolbarAction, applyToolbarAction } from "@/lib/markdown/toolbar";

import { ChecklistPreview } from "./checklist-preview";

const TOOLS: { action: ToolbarAction; label: string; Icon: typeof BoldIcon }[] = [
  { action: "bold", label: "Negrita", Icon: BoldIcon },
  { action: "italic", label: "Cursiva", Icon: ItalicIcon },
  // "Encabezado" y no "Título": el campo del título de la tarea está en la
  // misma pantalla, y dos controles con el mismo nombre accesible dejan a
  // quien navega por voz sin forma de distinguirlos.
  { action: "heading", label: "Encabezado", Icon: HeadingIcon },
  { action: "bulletList", label: "Lista", Icon: ListIcon },
  { action: "checklist", label: "Lista de verificación", Icon: ListChecksIcon },
  { action: "link", label: "Enlace", Icon: LinkIcon },
];

export type MarkdownEditorProps = {
  taskId: string;
  /** El cuerpo tal como está guardado. */
  value: string;
  /** Guarda el cuerpo. Resuelve con el error si lo hubo. */
  onSave: (body: string) => Promise<{ error: string } | undefined>;
  /** Marca o desmarca una casilla. La reescritura la hace el servidor. */
  onToggleChecklistItem: (
    index: number,
    checked: boolean,
  ) => Promise<{ error: string } | undefined>;
  /** Una tarea archivada se lee, no se edita. */
  readOnly?: boolean;
};

/**
 * El cuerpo de la tarea: **se lee por omisión y se edita a propósito**.
 *
 * Hasta KAM-29 esta tarjeta abría en modo escritura, con el `textarea`
 * monoespaciado y la barra de formato desplegados: abrir una tarea para
 * mirarla obligaba a pasar por encima de un editor que nadie había pedido, y
 * el cuerpo se mostraba como código fuente en vez de como texto.
 *
 * Ahora el cuerpo se rinde siempre y el editor vive detrás de *Editar*.
 * Pulsar el cuerpo **no** lo abre: es lo que mantiene las casillas marcables
 * de un solo toque, que es el uso más frecuente de esta tarjeta.
 *
 * La barra de herramientas existe para quien no sabe qué es Markdown; quien lo
 * sabe escribe la sintaxis y obtiene lo mismo, porque ambos caminos terminan
 * en el mismo texto. Lo que hace cada botón vive en `lib/markdown/toolbar.ts`
 * como función pura: aquí solo se conecta con la selección del `textarea`.
 */
export function MarkdownEditor({
  taskId,
  value,
  onSave,
  onToggleChecklistItem,
  readOnly = false,
}: MarkdownEditorProps) {
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = draft !== value;
  const { leave, dialog: discardDialog } = useDiscardConfirm(editing && dirty);

  /**
   * El borrador nace al **entrar** en edición, no al montar (design D1).
   *
   * El cuerpo puede haber cambiado por detrás mientras se leía —marcar una
   * casilla lo reescribe en el servidor—, y un borrador que sobreviviera a eso
   * abriría el editor con un texto viejo.
   */
  function startEditing() {
    setDraft(value);
    setTab("write");
    setError(null);
    setEditing(true);
  }

  function stopEditing() {
    setEditing(false);
    setError(null);
  }

  function applyTool(action: ToolbarAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const result = applyToolbarAction(
      draft,
      { start: textarea.selectionStart, end: textarea.selectionEnd },
      action,
    );
    setDraft(result.text);

    // El foco y la selección vuelven al textarea: aplicar formato no debe
    // costar un clic extra para seguir escribiendo.
    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selection.start, result.selection.end);
    });
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await onSave(draft);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Solo se cierra si el servidor aceptó: un editor que se cierra tras un
      // fallo se lleva por delante lo escrito.
      setEditing(false);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Descripción</CardTitle>

        {!readOnly &&
          (editing ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={save}
                disabled={saving}
                data-testid="save-body"
              >
                {saving ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                data-testid="cancel-body"
                onClick={() => leave(stopEditing)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="edit-body"
              onClick={startEditing}
            >
              <PencilIcon className="size-4" aria-hidden /> Editar
            </Button>
          ))}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ToggleGroup
                type="single"
                value={tab}
                onValueChange={(next) => next && setTab(next as "write" | "preview")}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="write">Escribir</ToggleGroupItem>
                <ToggleGroupItem value="preview">Vista previa</ToggleGroupItem>
              </ToggleGroup>

              {tab === "write" && (
                <div
                  className="flex flex-wrap items-center gap-1"
                  role="toolbar"
                  aria-label="Formato"
                >
                  {TOOLS.map(({ action, label, Icon }) => (
                    <Button
                      key={action}
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={label}
                      title={label}
                      onClick={() => applyTool(action)}
                    >
                      <Icon className="size-4" />
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {tab === "write" ? (
              <Textarea
                ref={textareaRef}
                aria-label="Descripción"
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="Anota el proceso, los pasos, lo que haga falta recordar."
              />
            ) : (
              <ChecklistPreview
                key={`draft-${value}`}
                taskId={taskId}
                // El borrador, no lo guardado: la vista previa es del mismo
                // contenido que se está escribiendo, o no sirve para revisarlo.
                body={draft}
                // Marcar una casilla reescribe el cuerpo **en el servidor**, y
                // el servidor todavía no tiene lo que se acaba de teclear: con
                // cambios sin guardar el índice apuntaría a otra línea. Se
                // congelan y se dice por qué, en vez de escribir en la línea
                // equivocada.
                frozenReason={
                  dirty
                    ? "Guarda la descripción para poder marcar las casillas."
                    : undefined
                }
                onToggle={onToggleChecklistItem}
              />
            )}
          </>
        ) : value.trim() === "" ? (
          /* Una tarea sin cuerpo no enseña un editor vacío: enseña por dónde
             empezar, y ese sitio es el que abre el editor. */
          readOnly ? (
            <p className="text-muted-foreground text-sm">Sin descripción.</p>
          ) : (
            <button
              type="button"
              data-testid="write-body"
              onClick={startEditing}
              className="text-muted-foreground hover:bg-muted/40 hover:text-foreground rounded-lg border border-dashed p-4 text-left text-sm transition-colors"
            >
              Anota el proceso, los pasos, lo que haga falta recordar.
            </button>
          )
        ) : (
          <ChecklistPreview
            key={value}
            taskId={taskId}
            body={value}
            readOnly={readOnly}
            onToggle={onToggleChecklistItem}
          />
        )}

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardContent>

      {discardDialog}
    </Card>
  );
}
