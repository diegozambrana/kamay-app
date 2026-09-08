/**
 * Lo que hace cada botón de la barra de herramientas del editor.
 *
 * Son transformaciones puras de `(texto, selección) → (texto, selección)`:
 * quien no sabe qué es Markdown aplica formato desde un botón, y quien lo sabe
 * escribe la sintaxis a mano y obtiene lo mismo. Vivir aquí y no en el
 * componente es lo que permite probar los casos difíciles —selección vacía,
 * selección de varias líneas, quitar el formato que ya estaba— sin rendir nada.
 */

export type ToolbarAction =
  | "bold"
  | "italic"
  | "heading"
  | "bulletList"
  | "checklist"
  | "link";

export type Selection = { start: number; end: number };

export type ToolbarResult = { text: string; selection: Selection };

/** Los delimitadores de los formatos que envuelven la selección. */
const WRAPPERS: Partial<Record<ToolbarAction, string>> = {
  bold: "**",
  italic: "*",
};

/** Los prefijos de los formatos que actúan sobre la línea entera. */
const PREFIXES: Partial<Record<ToolbarAction, string>> = {
  heading: "## ",
  bulletList: "- ",
  checklist: "- [ ] ",
};

/** El texto que se deja seleccionado cuando no había nada seleccionado. */
const PLACEHOLDERS: Record<ToolbarAction, string> = {
  bold: "texto en negrita",
  italic: "texto en cursiva",
  heading: "Título",
  bulletList: "Elemento",
  checklist: "Paso",
  link: "texto del enlace",
};

/** Extremos de la línea que contiene la posición dada. */
function lineBounds(text: string, position: number): Selection {
  const start = text.lastIndexOf("\n", position - 1) + 1;
  const end = text.indexOf("\n", position);
  return { start, end: end === -1 ? text.length : end };
}

function applyWrapper(
  text: string,
  selection: Selection,
  action: ToolbarAction,
): ToolbarResult {
  const marker = WRAPPERS[action]!;
  const selected = text.slice(selection.start, selection.end);
  const before = text.slice(0, selection.start);
  const after = text.slice(selection.end);

  // Si lo seleccionado ya está envuelto, el botón lo quita: un botón que solo
  // sabe poner obliga a borrar a mano para deshacer.
  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const desnudo = selected.slice(marker.length, selected.length - marker.length);
    return {
      text: `${before}${desnudo}${after}`,
      selection: { start: selection.start, end: selection.start + desnudo.length },
    };
  }

  const contenido = selected === "" ? PLACEHOLDERS[action] : selected;
  const inicio = selection.start + marker.length;

  return {
    text: `${before}${marker}${contenido}${marker}${after}`,
    selection: { start: inicio, end: inicio + contenido.length },
  };
}

function applyPrefix(
  text: string,
  selection: Selection,
  action: ToolbarAction,
): ToolbarResult {
  const prefix = PREFIXES[action]!;
  const bounds = {
    start: lineBounds(text, selection.start).start,
    end: lineBounds(text, selection.end).end,
  };

  const lines = text.slice(bounds.start, bounds.end).split("\n");
  // Si todas las líneas ya lo llevan, el botón lo quita.
  const yaAplicado = lines.every((line) => line.startsWith(prefix));

  const transformadas = lines.map((line) => {
    if (yaAplicado) return line.slice(prefix.length);
    // Una línea vacía recibe el prefijo y su marcador de posición, para que el
    // cursor caiga sobre algo que se pueda escribir encima.
    if (line === "") return `${prefix}${PLACEHOLDERS[action]}`;
    return `${prefix}${line}`;
  });

  const cuerpo = transformadas.join("\n");

  return {
    text: `${text.slice(0, bounds.start)}${cuerpo}${text.slice(bounds.end)}`,
    selection: yaAplicado
      ? { start: bounds.start, end: bounds.start + cuerpo.length }
      : {
          start: bounds.start + prefix.length,
          end: bounds.start + cuerpo.length,
        },
  };
}

function applyLink(text: string, selection: Selection): ToolbarResult {
  const selected = text.slice(selection.start, selection.end);
  const rotulo = selected === "" ? PLACEHOLDERS.link : selected;
  const before = text.slice(0, selection.start);
  const after = text.slice(selection.end);

  // El destino queda seleccionado, que es lo siguiente que hay que escribir.
  const destinoStart = selection.start + rotulo.length + 3;

  return {
    text: `${before}[${rotulo}](https://)${after}`,
    selection: { start: destinoStart, end: destinoStart + "https://".length },
  };
}

/** Aplica un botón de la barra sobre el texto y la selección actuales. */
export function applyToolbarAction(
  text: string,
  selection: Selection,
  action: ToolbarAction,
): ToolbarResult {
  if (action === "link") return applyLink(text, selection);
  if (action in WRAPPERS) return applyWrapper(text, selection, action);
  return applyPrefix(text, selection, action);
}
