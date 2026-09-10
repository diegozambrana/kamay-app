import type { StatusKind, TaskLinkType } from "@/types";

/**
 * Los entregables de una tarea: qué debe existir cuando se cierra.
 *
 * El dominio es el `check` de `task_deliverables` (§12), los seis y nada más:
 * un tipo nuevo se escribe primero en la especificación funcional, después en
 * el esquema, y solo entonces aquí (convención nº 11).
 */
export const DELIVERABLE_TYPES = [
  "product",
  "supply",
  "supplier",
  "purchase",
  "expenses",
  "asset",
] as const;

export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

/**
 * Qué crea cada tipo, y qué hace falta para ofrecerlo.
 *
 * Es un dato, no una cadena de condicionales repartida por la interfaz (D6).
 * El selector, la acción y el asistente leen todos de aquí, así que ninguno
 * puede ofrecer lo que otro rechaza.
 */
export type DeliverableDefinition = {
  type: DeliverableType;
  /** Rótulo visible. Español, como todo lo que ve el usuario (convención nº 8). */
  label: string;
  /** La tabla donde aterriza el registro creado. */
  target: "items" | "contacts" | "expenses" | "asset_details";
  /**
   * El tipo de vínculo que se escribe en `task_links` al cumplirlo, para que lo
   * creado quede colgado de la tarea que lo originó.
   *
   * Un activo se vincula como `asset` y no como `item` aunque su `entity_id`
   * sea el del ítem: el vínculo dice qué se creó, y lo que se creó fue el
   * activo sobre un ítem que ya existía o que se crea con él.
   */
  linkType: TaskLinkType;
  /**
   * Solo la persona dueña puede declararlo y cumplirlo.
   *
   * Únicamente el activo: `asset_details` tiene sus tres políticas bajo
   * `is_owner()` (KAM-19), así que ofrecérselo a un ayudante sería ofrecerle un
   * formulario que la base va a rechazar.
   */
  ownerOnly: boolean;
};

export const DELIVERABLE_DEFINITIONS: Record<
  DeliverableType,
  DeliverableDefinition
> = {
  product: {
    type: "product",
    label: "Nuevo producto",
    target: "items",
    linkType: "item",
    ownerOnly: false,
  },
  supply: {
    type: "supply",
    label: "Nuevo insumo",
    target: "items",
    linkType: "item",
    ownerOnly: false,
  },
  supplier: {
    type: "supplier",
    label: "Nuevo proveedor",
    target: "contacts",
    linkType: "contact",
    ownerOnly: false,
  },
  purchase: {
    type: "purchase",
    label: "Compra registrada",
    target: "expenses",
    linkType: "expense",
    ownerOnly: false,
  },
  expenses: {
    type: "expenses",
    label: "Gastos registrados",
    target: "expenses",
    linkType: "expense",
    ownerOnly: false,
  },
  asset: {
    type: "asset",
    label: "Nuevo activo",
    target: "asset_details",
    linkType: "asset",
    // El único reservado de los seis. Ver `ownerOnly` en el tipo.
    ownerOnly: true,
  },
};

/** Los tipos que se pueden ofrecer a quien mira, según su rol. */
export function declarableTypes(isOwner: boolean): DeliverableDefinition[] {
  return DELIVERABLE_TYPES.map((type) => DELIVERABLE_DEFINITIONS[type]).filter(
    (definition) => isOwner || !definition.ownerOnly,
  );
}

/** ¿Puede esta persona declarar o cumplir este entregable? */
export function canDeclare(type: DeliverableType, isOwner: boolean): boolean {
  return isOwner || !DELIVERABLE_DEFINITIONS[type].ownerOnly;
}

/** Un entregable tal como lo lee la pantalla. */
export type Deliverable = {
  id: string;
  taskId: string;
  deliverableType: DeliverableType;
  /** Qué se creó al cumplirlo, y cuándo. Los tres van juntos o ninguno. */
  fulfilledType: string | null;
  fulfilledId: string | null;
  fulfilledAt: string | null;
};

export function isFulfilled(deliverable: Deliverable): boolean {
  return deliverable.fulfilledAt !== null;
}

export function pendingDeliverables(
  deliverables: readonly Deliverable[],
): Deliverable[] {
  return deliverables.filter((deliverable) => !isFulfilled(deliverable));
}

/**
 * ¿Hay que abrir el asistente de cierre?
 *
 * Una sola función para las dos entradas —soltar en el tablero y cambiar el
 * estado desde el detalle— porque el mapa de navegación no admite una tercera
 * y escribir la condición dos veces es cómo una de ellas se queda atrás (D7).
 *
 * Se compara por `kind` y nunca por nombre (convención nº 5): el estado final
 * de una organización se llama *Entregado* y el de otra *Vendido*, y hay juegos
 * donde *Terminado* es de tipo `in_progress`.
 */
export function needsClosingWizard(
  statusKind: StatusKind,
  deliverables: readonly Deliverable[],
): boolean {
  return opensClosingWizard(statusKind, pendingDeliverables(deliverables).length);
}

/**
 * La misma decisión cuando solo se sabe **cuántos** quedan sin cumplir.
 *
 * Es lo que puede saber el tablero: sus tarjetas llevan un recuento, no la
 * lista. Las dos entradas al asistente pasan por aquí, que es lo que impide
 * que una acabe abriéndolo y la otra cerrando en silencio (D7).
 */
export function opensClosingWizard(
  statusKind: StatusKind,
  pendingCount: number,
): boolean {
  return statusKind === "final" && pendingCount > 0;
}

/**
 * ¿Queda la tarea marcada como *cerrada sin entregables*?
 *
 * La marca solo significa algo cuando había algo que crear: una tarea que nunca
 * declaró nada no cerró sin cumplir, es que no había nada que cumplir. Marcarla
 * llenaría de ruido el filtro que la hace localizable (supuesto 8).
 *
 * La misma regla la aplica `close_task_with_deliverables` en la base, que es
 * quien de verdad escribe la columna; aquí vive para que la pantalla pueda
 * anticipar lo que va a pasar sin inventarse un criterio distinto.
 */
export function closesWithoutDeliverables(
  deliverables: readonly Deliverable[],
  createdCount: number,
): boolean {
  return pendingDeliverables(deliverables).length > 0 && createdCount === 0;
}

/**
 * Lo que se sabe de la tarea al abrir el asistente.
 *
 * De los adjuntos solo hace falta identificarlos y nombrarlos: el prellenado
 * decide **cuáles** viajan, no qué son. Pedir el `Attachment` entero obligaría
 * al detalle a cargar columnas que su panel no usa.
 */
export type TaskContext = {
  title: string;
  businessLineId: string;
  bodyMarkdown: string | null;
  attachments: readonly { id: string; fileName: string }[];
};

/**
 * Los valores iniciales del formulario de un entregable.
 *
 * Deliberadamente laxo en su forma: cada tipo llena lo que su formulario
 * entiende y deja fuera lo que no. Un `Partial` por tipo obligaría a cinco
 * tipos de retorno y a un `switch` en cada consumidor para nada — lo que
 * importa es que el cálculo sea puro y esté probado tipo por tipo.
 */
export type DeliverablePrefill = {
  /** Nombre del ítem, del contacto, o descripción del egreso. */
  name: string;
  /** `null` cuando el destino admite ámbito compartido y la tarea no lo fija. */
  businessLineId: string | null;
  /** Notas o descripción, tomadas del cuerpo de la tarea. */
  notes: string | null;
  /** Los adjuntos que viajan al registro creado, por su identificador. */
  attachmentIds: string[];
  /** Solo para los que crean un ítem: qué tipo de ítem. */
  itemKind?: "product" | "supply" | "asset";
  /** Solo para el proveedor: el rol con el que nace el contacto. */
  contactRole?: "supplier";
  /** Solo para los egresos: `purchase` o `expense`. */
  expenseKind?: "purchase" | "expense";
  /**
   * Importe del gasto. Vacío a propósito: la tarea no sabe cuánto costó, y
   * autocompletarlo con un cero invitaría a guardarlo sin mirar.
   */
  amount?: string;
  /** Categoría del gasto. `create_expense` la exige y la tarea no la conoce. */
  expenseCategoryId?: string | null;
  /** Proveedor de la compra. `create_expense` lo exige. */
  contactId?: string | null;
  /** Las líneas de la compra: `create_expense` rechaza una sin ninguna. */
  items?: { itemId: string; quantity: string; unitPrice: string }[];
  /** Costo de adquisición del activo. */
  acquisitionCost?: string;
};

/**
 * El prellenado de cada tipo a partir de la tarea (D6).
 *
 * Función pura: sin red, sin React, sin base de datos. Es lo que hace que la
 * prueba unitaria que exige el backlog —«prellenado de cada tipo de
 * entregable»— sea una tabla de entradas y salidas.
 *
 * Todo lo que devuelve es una **propuesta**: el asistente lo deja modificar
 * entero antes de crear, igual que `prefillFromOrder` en el sentido inverso.
 */
export function prefillFor(
  type: DeliverableType,
  task: TaskContext,
): DeliverablePrefill {
  const base = {
    name: task.title,
    businessLineId: task.businessLineId,
    notes: task.bodyMarkdown,
    attachmentIds: task.attachments.map((attachment) => attachment.id),
  };

  switch (type) {
    case "product":
      return { ...base, itemKind: "product" };
    case "supply":
      return { ...base, itemKind: "supply" };
    case "asset":
      return { ...base, itemKind: "asset", acquisitionCost: "" };
    case "supplier":
      // Un contacto no pertenece a una línea: el directorio es de toda la
      // organización. Llevarle la línea de la tarea sería inventar un campo.
      return { ...base, businessLineId: null, contactRole: "supplier" };
    case "purchase":
      // Sin proveedor ni líneas: la tarea no los sabe, y la base los exige.
      // El asistente los pide; lo que la tarea sí aporta es la descripción,
      // la línea y sus adjuntos.
      return {
        ...base,
        expenseKind: "purchase",
        contactId: null,
        items: [],
      };
    case "expenses":
      return {
        ...base,
        expenseKind: "expense",
        amount: "",
        expenseCategoryId: null,
      };
  }
}
