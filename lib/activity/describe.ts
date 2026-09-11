/**
 * Un evento de bitácora leído en lenguaje natural.
 *
 * "La bitácora se lee en lenguaje natural, no en jerga" (§11 de la
 * especificación funcional). Quien mira el panel un lunes por la mañana no
 * quiere `orders.status_changed`, quiere "Diego cambió el estado del pedido
 * #142".
 *
 * Es una función pura y vive en `lib/` a propósito: no toca Supabase y se
 * prueba sin base de datos. La comparten el panel, V23 y los cinco bloques de
 * historial contextual, para que un mismo evento no se lea de dos maneras
 * según la pantalla desde la que se mire.
 */

/** Lo que hace falta para redactar. Menos que un `ActivityEntry` completo. */
export type DescribableEvent = {
  action: string;
  tableName: string;
  /** Quién lo hizo, ya resuelto a nombre. `null` si no se pudo resolver. */
  actorName?: string | null;
  /** 'sistema' o el nombre de una plataforma externa. */
  actorLabel?: string | null;
  /** El identificador humano del registro: el `#142` del pedido. */
  recordLabel?: string | null;
};

/**
 * Cómo se nombra cada tabla en una frase. La clave es el nombre real de la
 * tabla porque es lo que la bitácora guarda; el valor es lo que se dice.
 *
 * Una tabla que no esté aquí no rompe nada: se cae a "un registro", que es
 * vago pero cierto. Preferible a filtrar el nombre de la tabla a la pantalla.
 */
const SUBJECTS: Record<string, string> = {
  orders: "el pedido",
  order_items: "una línea del pedido",
  expenses: "el egreso",
  expense_items: "una línea del egreso",
  payments: "el movimiento de dinero",
  items: "el ítem",
  item_variants: "la variante",
  contacts: "el contacto",
  business_lines: "la línea de negocio",
  statuses: "el estado",
  sales_channels: "el canal",
  expense_categories: "la categoría de gasto",
  units: "la unidad",
  organizations: "la organización",
  memberships: "la persona del equipo",
  attachments: "el adjunto",
  asset_details: "el activo",
  tasks: "la tarea",
  tags: "la etiqueta",
  invitations: "la invitación",
  inventory_movements: "el movimiento de inventario",
  membership_lines: "el acceso a la línea",
  task_links: "el vínculo de la tarea",
  task_deliverables: "el entregable de la tarea",
};

/**
 * El verbo de cada acción, en tercera persona y en pasado.
 *
 * `activity_log` restringe `action` por `check`, así que estas cinco son hoy
 * todas las que existen. La redacción genérica no es defensa contra un valor
 * imposible sino contra el día en que esa lista crezca: una acción nueva debe
 * producir una frase pobre, no una pantalla rota ni un identificador suelto.
 */
const VERBS: Record<string, string> = {
  created: "registró",
  updated: "editó",
  status_changed: "cambió el estado de",
  archived: "archivó",
  unarchived: "desarchivó",
};

const UNKNOWN_ACTOR = "Alguien";
const UNKNOWN_SUBJECT = "un registro";
const UNKNOWN_VERB = "actualizó";

/**
 * La frase completa: quién, qué hizo y sobre qué.
 *
 * Sin persona identificada y sin etiqueta, el sujeto es "Alguien": la
 * bitácora no inventa un autor, pero tampoco deja la frase coja.
 */
export function describeEvent(event: DescribableEvent): string {
  const actor = actorOf(event);
  const verb = VERBS[event.action] ?? UNKNOWN_VERB;
  const subject = SUBJECTS[event.tableName] ?? UNKNOWN_SUBJECT;
  const label = event.recordLabel?.trim();

  return contract(`${actor} ${verb} ${subject}${label ? ` ${label}` : ""}`);
}

/**
 * "cambió el estado de el pedido" no lo dice nadie. La contracción vive aquí,
 * una sola vez, en vez de duplicar cada sujeto en dos formas —una para los
 * verbos que rigen preposición y otra para los que no—.
 */
function contract(sentence: string): string {
  return sentence.replace(/\bde el\b/g, "del").replace(/\ba el\b/g, "al");
}

/**
 * Quién. Una persona si se pudo resolver su nombre; si no, la etiqueta que el
 * propio evento guarda —'sistema' o la plataforma externa que escribió—.
 *
 * La etiqueta se guarda justamente para esto: un evento sin `actor_id` no es
 * un evento sin autor, es un evento cuyo autor no es una persona.
 */
function actorOf({ actorName, actorLabel }: DescribableEvent): string {
  const name = actorName?.trim();
  if (name) return name;

  const label = actorLabel?.trim();
  if (label) return capitalize(label);

  return UNKNOWN_ACTOR;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Dónde vive el registro afectado por un evento, si tiene pantalla propia.
 *
 * `null` cuando no la tiene —una línea de pedido no se abre por su cuenta, la
 * configuración no tiene detalle por fila—, y entonces el evento se cuenta
 * igual pero sin enlace: lo que ocurrió ocurrió, aunque no haya adónde ir.
 *
 * No comprueba que el registro siga existiendo: eso costaría una consulta por
 * evento. Un enlace a un registro archivado es correcto —lo archivado se
 * consulta— y uno a un registro inexistente es el 404 propio de la pantalla
 * de destino, no un problema de la bitácora.
 */
export function recordHref(
  tableName: string,
  recordId: string,
): string | null {
  switch (tableName) {
    case "orders":
      return `/orders/${recordId}`;
    case "expenses":
      return `/expenses/${recordId}`;
    case "items":
      return `/catalog/${recordId}`;
    case "tasks":
      return `/tasks/${recordId}`;
    // El contacto no tiene página propia: se selecciona en la lista de dos
    // paneles, y el panel derecho es su detalle.
    case "contacts":
      return `/contacts?id=${recordId}`;
    // El activo se abre seleccionado en su lista. Funciona porque
    // `asset_details.id` es una columna generada `as (item_id) stored` que
    // KAM-19 añadió para que el trigger de auditoría tuviera un `id`: el
    // `record_id` del evento **es** el del ítem, no uno propio.
    case "asset_details":
      return `/assets?selected=${recordId}`;
    default:
      return null;
  }
}

/**
 * El diccionario de sujetos, expuesto solo para la prueba de cobertura.
 *
 * `tests/integration/activity-fields-coverage.test.ts` compara esta lista con
 * las tablas que de verdad llevan el trigger `audit`, para que una tabla nueva
 * no se lea como «un registro» sin que nadie se entere. No se usa fuera de
 * ahí: quien redacta llama a `describeEvent()`.
 */
export const SUBJECTS_FOR_TESTS: Readonly<Record<string, string>> = SUBJECTS;
