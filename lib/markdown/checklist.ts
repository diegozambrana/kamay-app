/**
 * Listas de verificación del cuerpo de una tarea (design D2).
 *
 * El esquema no tiene tabla de ítems de lista de verificación y no se inventa
 * ninguna (convención nº 11): el cuerpo Markdown **es** el dato. Marcar una
 * casilla es, por tanto, reescribir su línea.
 *
 * Todo vive aquí como funciones puras sobre cadenas para que los casos
 * difíciles —sangría anidada, marcador `*`, una casilla dentro de un bloque de
 * código— se prueben sin navegador ni base de datos.
 */

/**
 * Una casilla: `- [ ]` o `* [x]`, con sangría opcional.
 *
 * Los grupos son: sangría, marcador de lista, la marca de dentro de los
 * corchetes y el texto que sigue. Se conservan todos al reescribir para que
 * alternar no reformatee la línea de nadie.
 */
const CHECKLIST_LINE = /^(\s*)([-*+])(\s+)\[([ xX])\](\s*)(.*)$/;

/** Apertura o cierre de un bloque de código cercado: ``` o ~~~, con sangría. */
const FENCE = /^\s*(`{3,}|~{3,})/;

export type ChecklistItem = {
  /** Posición de la casilla en el orden en que se rinde, empezando en 0. */
  index: number;
  /** Línea del cuerpo donde vive, empezando en 0. */
  line: number;
  checked: boolean;
  text: string;
};

/**
 * Las casillas del cuerpo, en el mismo orden en que `remark-gfm` las rinde.
 *
 * Ese orden es lo que hace que el índice del clic y el índice de la
 * reescritura sean el mismo (design D2). Las casillas escritas dentro de un
 * bloque de código cercado **no cuentan**: se rinden como texto, no como
 * casilla, y contarlas desplazaría todos los índices siguientes.
 */
export function parseChecklistItems(body: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const lines = body.split("\n");

  let openFence: string | null = null;

  for (const [line, content] of lines.entries()) {
    const fence = FENCE.exec(content);
    if (fence) {
      const marker = fence[1];
      if (openFence === null) {
        openFence = marker[0];
        continue;
      }
      // Cierra solo el cercado del mismo carácter: un ~~~ dentro de un bloque
      // ``` es contenido, no el final del bloque.
      if (marker[0] === openFence) openFence = null;
      continue;
    }

    if (openFence !== null) continue;

    const match = CHECKLIST_LINE.exec(content);
    if (!match) continue;

    items.push({
      index: items.length,
      line,
      checked: match[4].toLowerCase() === "x",
      text: match[6],
    });
  }

  return items;
}

/**
 * Marca o desmarca la casilla número `index` y devuelve el cuerpo resultante.
 *
 * Reescribe **solo** esa línea: el resto del cuerpo sale byte a byte como
 * entró. Es lo que permite que marcar el paso 3 no borre el párrafo que otra
 * persona añadió hace diez segundos.
 *
 * Si el índice no existe —porque el cuerpo cambió entre el clic y la
 * escritura— devuelve el cuerpo intacto, en vez de adivinar a qué casilla se
 * refería.
 */
export function toggleChecklistItem(
  body: string,
  index: number,
  checked: boolean,
): string {
  const target = parseChecklistItems(body).find((item) => item.index === index);
  if (!target) return body;

  const lines = body.split("\n");
  const match = CHECKLIST_LINE.exec(lines[target.line]);
  // No puede fallar: `parseChecklistItems` acaba de casar esa misma línea.
  if (!match) return body;

  const [, indent, marker, afterMarker, , afterBox, text] = match;
  lines[target.line] =
    `${indent}${marker}${afterMarker}[${checked ? "x" : " "}]${afterBox}${text}`;

  return lines.join("\n");
}
