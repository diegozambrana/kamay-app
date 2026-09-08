"use client";

import { createContext, useContext, useState } from "react";

import { parseChecklistItems } from "@/lib/markdown/checklist";
import { MarkdownView } from "@/lib/markdown/markdown-view";

/**
 * Lo que una casilla necesita para funcionar, resuelto por el elemento de
 * lista que la contiene.
 *
 * Hace falta bajarlo por contexto porque el `input` que emite `remark-gfm` es
 * **sintético**: lo fabrica el plugin y no lleva posición del texto original,
 * así que por sí solo no puede saber qué casilla es. El `li` que lo contiene
 * sí la lleva —y la conserva tras el saneado—, de modo que el índice se
 * resuelve arriba y baja hasta aquí.
 */
type ChecklistItemHandle = {
  index: number;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

const ChecklistItemContext = createContext<ChecklistItemHandle | null>(null);

/**
 * La casilla viva que sustituye a la deshabilitada de `remark-gfm`.
 *
 * Vive fuera del componente de la vista previa a propósito: definirla dentro
 * la recrearía en cada renderizado, y así además el hook queda donde las
 * reglas de React esperan encontrarlo.
 */
function ChecklistCheckbox(props: React.ComponentProps<"input">) {
  const item = useContext(ChecklistItemContext);

  // Lo que no sea una casilla de lista de verificación se rinde tal cual: el
  // saneado ya decidió qué atributos sobreviven.
  if (props.type !== "checkbox" || item === null) return <input {...props} />;

  return (
    <input
      type="checkbox"
      className="accent-primary mt-1 size-4 shrink-0"
      data-checklist-index={item.index}
      checked={item.checked}
      disabled={item.disabled}
      aria-label={`Paso ${item.index + 1}`}
      onChange={(event) => item.onChange(event.target.checked)}
    />
  );
}

export type ChecklistPreviewProps = {
  taskId: string;
  /** El cuerpo tal como está guardado; se sanea al rendirlo. */
  body: string;
  readOnly?: boolean;
  /** Si llega, las casillas no responden y se explica por qué. */
  frozenReason?: string;
  onToggle: (
    index: number,
    checked: boolean,
  ) => Promise<{ error: string } | undefined>;
};

/**
 * La vista previa del cuerpo, con sus casillas marcables (design D2).
 *
 * El índice de cada casilla sale de **su posición en el texto**, no del orden
 * en que se rinde: es el mismo orden en que `toggleChecklistItem` cuenta las
 * líneas, y así el índice del clic y el de la reescritura son el mismo aunque
 * `react-markdown` decida rendir cuando le parezca.
 *
 * El estado marcado no se guarda en ninguna parte: vive en el cuerpo y se
 * reescribe allí. Lo único que hay aquí es el optimismo mientras el servidor
 * responde.
 */
export function ChecklistPreview({
  taskId,
  body,
  readOnly = false,
  frozenReason,
  onToggle,
}: ChecklistPreviewProps) {
  const [optimista, setOptimista] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const congelado = readOnly || frozenReason !== undefined;

  if (body.trim() === "") {
    return (
      <p className="text-muted-foreground text-sm" data-testid="empty-body">
        Sin descripción todavía.
      </p>
    );
  }

  const items = parseChecklistItems(body);
  // De la línea del documento —1 en base, como la reporta `react-markdown`— al
  // índice de casilla que usa `toggleChecklistItem`.
  const indexByLine = new Map(items.map((item) => [item.line + 1, item.index]));

  async function alternar(index: number, checked: boolean) {
    setOptimista((state) => ({ ...state, [index]: checked }));
    setError(null);

    const result = await onToggle(index, checked);
    if (result?.error) {
      setError(result.error);
      // Se deshace: la casilla no puede quedar diciendo algo que el cuerpo
      // guardado no dice.
      setOptimista((state) => ({ ...state, [index]: !checked }));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <MarkdownView
        key={taskId}
        components={{
          li({ node, children, ...props }) {
            const linea = node?.position?.start.line;
            const index = linea === undefined ? undefined : indexByLine.get(linea);

            if (index === undefined) return <li {...props}>{children}</li>;

            return (
              <li {...props}>
                <ChecklistItemContext.Provider
                  value={{
                    index,
                    checked: optimista[index] ?? items[index].checked,
                    disabled: congelado,
                    onChange: (checked) => void alternar(index, checked),
                  }}
                >
                  {children}
                </ChecklistItemContext.Provider>
              </li>
            );
          },
          input: ChecklistCheckbox,
        }}
      >
        {body}
      </MarkdownView>

      {frozenReason && (
        <p className="text-muted-foreground text-xs" data-testid="checklist-frozen">
          {frozenReason}
        </p>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
