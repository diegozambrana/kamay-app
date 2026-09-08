"use client";

import {
  BoldIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListChecksIcon,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type ToolbarAction, applyToolbarAction } from "@/lib/markdown/toolbar";
import { cn } from "@/lib/utils";

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
 * El cuerpo de la tarea: *Escribir* y *Vista previa* sobre el mismo contenido.
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
  const [tab, setTab] = useState<"write" | "preview">(
    // Una tarea archivada se abre por su vista previa: no hay nada que escribir.
    readOnly ? "preview" : "write",
  );
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = draft !== value;

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
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          value={tab}
          onValueChange={(next) => next && setTab(next as "write" | "preview")}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="write" disabled={readOnly}>
            Escribir
          </ToggleGroupItem>
          <ToggleGroupItem value="preview">Vista previa</ToggleGroupItem>
        </ToggleGroup>

        {tab === "write" && !readOnly && (
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

      {tab === "write" && !readOnly ? (
        <Textarea
          ref={textareaRef}
          aria-label="Descripción"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => dirty && save()}
          rows={12}
          className="font-mono text-sm"
          placeholder="Anota el proceso, los pasos, lo que haga falta recordar."
        />
      ) : (
        <ChecklistPreview
          key={value}
          taskId={taskId}
          // El borrador, no lo guardado: la vista previa es del mismo
          // contenido que se está escribiendo, o no sirve para revisarlo.
          body={draft}
          readOnly={readOnly}
          // Marcar una casilla reescribe el cuerpo **en el servidor**, y el
          // servidor todavía no tiene lo que se acaba de teclear: con cambios
          // sin guardar el índice apuntaría a otra línea. Se congelan y se
          // dice por qué, en vez de escribir en la línea equivocada.
          frozenReason={
            dirty ? "Guarda la descripción para poder marcar las casillas." : undefined
          }
          onToggle={onToggleChecklistItem}
        />
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? "Guardando…" : "Guardar descripción"}
          </Button>
          <span
            className={cn(
              "text-muted-foreground text-xs",
              !dirty && "invisible",
            )}
          >
            Hay cambios sin guardar.
          </span>
        </div>
      )}
    </div>
  );
}
