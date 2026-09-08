import { defaultSchema } from "rehype-sanitize";

/**
 * Esquema de saneado del cuerpo de una tarea (design D1).
 *
 * Se parte de `defaultSchema` de `rehype-sanitize` y se recorta, en vez de
 * escribir la lista de permitidos a mano: la lista de esquemas de URL
 * peligrosos y de atributos de evento es larga y se descubre por incidentes,
 * así que actualizar la dependencia debe traer las correcciones.
 *
 * El cuerpo se guarda tal como se escribió y se sanea **al rendirlo**: sanear
 * al guardar destruiría lo que la persona escribió, haría irreversible un
 * falso positivo y dejaría sin proteger lo guardado antes de que el saneado
 * existiera.
 */

type Schema = typeof defaultSchema;

const base = defaultSchema;

/** Atributos comunes que el esquema por omisión permite en cualquier etiqueta. */
const anyTag = base.attributes?.["*"] ?? [];

export const taskBodySchema: Schema = {
  ...base,

  tagNames: [
    ...(base.tagNames ?? []),
    // La casilla de `remark-gfm`: sin ella una lista de verificación se rinde
    // como texto y el requisito de marcarlas no se puede cumplir.
    "input",
  ],

  attributes: {
    ...base.attributes,

    /**
     * `img` sin `src`. Una imagen del cuerpo tendría que salir de los
     * adjuntos, y hoy no existe forma de referenciarlos desde el Markdown:
     * cualquier `src` que llegue aquí apunta a un servidor de terceros que
     * registraría quién mira la tarea y cuándo. El elemento sobrevive con su
     * texto alternativo; la petición remota, no.
     */
    img: ["alt", "title"],

    /**
     * La casilla de una lista de verificación. `disabled` se permite porque
     * es lo que `remark-gfm` emite; que la casilla responda o no lo decide la
     * vista previa, no el saneado.
     */
    input: [["type", "checkbox"], "checked", "disabled"],

    // Las clases que `remark-gfm` pone en las listas de verificación, y solo
    // esas: la forma de tupla restringe los valores admitidos, de modo que
    // `class` no se convierte en un canal libre.
    li: [...(base.attributes?.li ?? []), ["className", "task-list-item"]],
    ul: [...(base.attributes?.ul ?? []), ["className", "contains-task-list"]],
    ol: [...(base.attributes?.ol ?? []), ["className", "contains-task-list"]],

    "*": anyTag,
  },

  /**
   * Los esquemas de URL admitidos. Se declaran explícitamente en vez de
   * heredarse para que un cambio en la dependencia no amplíe en silencio lo
   * que un enlace del cuerpo puede abrir. `javascript:` no está, que es el
   * punto.
   */
  protocols: {
    ...base.protocols,
    href: ["http", "https", "mailto", "tel"],
  },
};
