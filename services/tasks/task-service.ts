import type { SupabaseClient } from "@supabase/supabase-js";

import { matchesSearch, normalizeForSearch } from "@/lib/search/normalize";
import type {
  Deliverable,
  DeliverableType,
} from "@/lib/tasks/deliverables";
import type { TaskInput } from "@/lib/tasks/schema";
import type { Tag, Task, TaskLinkType } from "@/types";

type TaskRow = {
  id: string;
  organization_id: string;
  business_line_id: string;
  status_id: string;
  title: string;
  body_markdown: string | null;
  assignee_id: string | null;
  due_at: string | null;
  remind_at: string | null;
  closed_at: string | null;
  closed_without_deliverables: boolean;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
  task_tags: { tag: { id: string; organization_id: string; name: string } | null }[] | null;
};

/** Las columnas de una tarea. Todas: KAM-21 encendió la última que faltaba. */
const COLUMNS =
  "id, organization_id, business_line_id, status_id, title, body_markdown, " +
  "assignee_id, due_at, remind_at, closed_at, closed_without_deliverables, " +
  "created_by, created_at, archived_at, " +
  "task_tags (tag:tags (id, organization_id, name))";

export type TaskFilters = {
  businessLineId?: string | null;
  statusId?: string;
  assigneeId?: string;
  tagId?: string;
  search?: string;
  includeArchived?: boolean;
};

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    organizationId: row.organization_id,
    businessLineId: row.business_line_id,
    statusId: row.status_id,
    title: row.title,
    bodyMarkdown: row.body_markdown,
    assigneeId: row.assignee_id,
    dueAt: row.due_at,
    remindAt: row.remind_at,
    closedAt: row.closed_at,
    closedWithoutDeliverables: row.closed_without_deliverables,
    createdBy: row.created_by,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    tags: (row.task_tags ?? [])
      .map((link) => link.tag)
      .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
      .map((tag) => ({
        id: tag.id,
        organizationId: tag.organization_id,
        name: tag.name,
      })),
  };
}

/**
 * Un vínculo resuelto contra su destino, listo para rendir.
 *
 * **Nada de esto se almacena.** `task_links` guarda tipo e identificador y
 * nada más; el nombre y el estado se leen del registro apuntado cada vez que
 * se rinde, que es lo que hace cierto «refleja el estado actual, no una copia»
 * (D2). Renombrar el ítem cambia lo que se ve sin tocar el vínculo.
 */
export type ResolvedTaskLink = {
  entityType: TaskLinkType;
  entityId: string;
  /** Nombre, o «Pedido #142» para un pedido. */
  label: string;
  /** Estado actual del destino, cuando lo tiene. Los ítems y contactos no. */
  statusName: string | null;
  archived: boolean;
};

/** Un acierto del buscador único de vínculos. */
export type LinkTarget = {
  entityType: TaskLinkType;
  entityId: string;
  label: string;
  /** Lo que distingue a este registro de otro del mismo nombre. */
  hint: string | null;
};

/** Una tarea tal como la lista el bloque *Tareas relacionadas*. */
export type RelatedTask = {
  id: string;
  title: string;
  statusName: string | null;
  dueAt: string | null;
  closedAt: string | null;
};

/**
 * Los tipos que el buscador consulta, en el orden en que se ofrecen.
 *
 * El activo va aparte porque no se ofrece a todo el mundo: `asset_details`
 * tiene sus tres políticas bajo `is_owner()` (D9).
 */
const SEARCH_LIMIT = 8;

/**
 * Acceso a `tasks`. Todo acceso a Supabase vive en services/.
 *
 * **Aquí no hay ninguna comprobación de rol ni de línea.** Quién ve qué lo
 * decide la política de RLS con `has_line_access()`, de modo que una consulta
 * directa devuelva exactamente lo mismo que la pantalla. Repetir la condición
 * aquí solo crearía un segundo sitio donde equivocarse.
 */
export class TaskService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** Las tareas que el tablero, la lista y el calendario comparten. */
  async listForBoard(
    organizationId: string,
    filters: TaskFilters = {},
  ): Promise<Task[]> {
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    let query = this.supabase
      .from("tasks")
      .select(COLUMNS)
      .eq("organization_id", organizationId);

    if (filters.businessLineId) {
      query = query.eq("business_line_id", filters.businessLineId);
    }
    if (filters.statusId) query = query.eq("status_id", filters.statusId);
    if (filters.assigneeId) query = query.eq("assignee_id", filters.assigneeId);
    if (!filters.includeArchived) query = query.is("archived_at", null);
    if (filters.search) query = query.ilike("title", `%${filters.search}%`);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .overrideTypes<TaskRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar las tareas: ${error.message}`);
    }

    const tasks = (data ?? []).map(toTask);

    // La etiqueta filtra en memoria: en PostgREST, filtrar por una tabla
    // anidada recortaría las etiquetas de las filas que sí pasan, y la tarjeta
    // dejaría de mostrar las demás etiquetas de la tarea.
    return filters.tagId
      ? tasks.filter((task) => task.tags.some((tag) => tag.id === filters.tagId))
      : tasks;
  }

  /**
   * Las tareas abiertas para *Mis pendientes* (V20) y para la tarjeta del
   * panel.
   *
   * **Sin filtro de línea, a propósito**: V20 es una de las dos únicas vistas
   * que ignoran el selector de línea —la otra es el comparativo de Reportes—,
   * porque aquí el valor está justamente en ver todo junto.
   *
   * **Sin comprobación de rol, como el resto del servicio**: el alcance del
   * ayudante —su línea o lo asignado a él— lo aplica la política de RLS, de
   * modo que esta consulta devuelve exactamente lo que esa persona puede ver
   * sin repetir la condición en un segundo sitio donde equivocarse.
   *
   * Cae sobre el índice `(organization_id, due_at) where archived_at is null
   * and closed_at is null` que `tasks` ya declara.
   */
  async listPending(organizationId: string): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from("tasks")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .is("closed_at", null)
      // Sin fecha al final: la agrupación las recoloca, pero llegar ya
      // ordenadas evita que el grupo *Sin fecha* dependa del orden de inserción.
      .order("due_at", { ascending: true, nullsFirst: false })
      .overrideTypes<TaskRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar los pendientes: ${error.message}`);
    }

    return (data ?? []).map(toTask);
  }

  async getById(organizationId: string, id: string): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from("tasks")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo cargar la tarea: ${error.message}`);
    }

    return data ? toTask(data as unknown as TaskRow) : null;
  }

  /**
   * Crea la tarea con sus etiquetas y su vínculo.
   *
   * El `status_id` no se manda: lo resuelve el trigger de la base con el juego
   * que aplica a la línea (design D3). Eso es lo que permite que el alta rápida
   * viaje con dos campos.
   *
   * El vínculo se escribe **en la misma llamada** que la tarea: si se guardara
   * después, un fallo de red dejaría tareas creadas desde un pedido sin
   * vínculo, y la interfaz que lo repararía es de KAM-21.
   */
  async create(
    organizationId: string,
    input: TaskInput,
    createdBy: string,
    tagIds: string[] = [],
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from("tasks")
      .insert({
        organization_id: organizationId,
        business_line_id: input.businessLineId,
        title: input.title,
        assignee_id: input.assigneeId ?? createdBy,
        due_at: input.dueDate ? `${input.dueDate}T00:00:00Z` : null,
        created_by: createdBy,
      })
      .select("id")
      .single()
      .overrideTypes<{ id: string }>();

    if (error || !data) {
      throw new Error(`No se pudo crear la tarea: ${error?.message ?? ""}`);
    }

    if (tagIds.length > 0) {
      await this.setTags(organizationId, data.id, tagIds);
    }

    if (input.link) {
      await this.link(
        organizationId,
        data.id,
        input.link.entityType,
        input.link.entityId,
      );
    }

    return data.id;
  }

  /**
   * Los campos editables de una tarea.
   *
   * Cada uno se manda por separado y solo se escribe lo que llega definido:
   * es lo que permite que el detalle guarde campo a campo sin releer la tarea
   * entera y sin pisar lo que otra persona acaba de cambiar (design D3).
   *
   * KAM-15 abrió título, responsable y fecha límite; KAM-16 suma el cuerpo, el
   * estado, la línea y el recordatorio.
   */
  async updateFields(
    organizationId: string,
    id: string,
    fields: {
      title?: string;
      assigneeId?: string | null;
      dueDate?: string | null;
      bodyMarkdown?: string | null;
      statusId?: string;
      businessLineId?: string;
      remindAt?: string | null;
    },
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.assigneeId !== undefined) patch.assignee_id = fields.assigneeId;
    if (fields.dueDate !== undefined) {
      patch.due_at = fields.dueDate ? `${fields.dueDate}T00:00:00Z` : null;
    }
    if (fields.bodyMarkdown !== undefined) {
      patch.body_markdown = fields.bodyMarkdown;
    }
    if (fields.statusId !== undefined) patch.status_id = fields.statusId;
    if (fields.businessLineId !== undefined) {
      patch.business_line_id = fields.businessLineId;
    }
    if (fields.remindAt !== undefined) patch.remind_at = fields.remindAt;

    const { error } = await this.supabase
      .from("tasks")
      .update(patch)
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo guardar la tarea: ${error.message}`);
    }
  }

  /**
   * Mueve la tarea de columna, en cualquier dirección.
   *
   * No hay nada más que hacer: `closed_at` lo lleva el trigger, y no existe
   * ninguna escritura sobre `orders` —ni sobre ninguna otra tabla— colgando de
   * este movimiento (convención nº 10).
   */
  async moveToStatus(
    organizationId: string,
    id: string,
    statusId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("tasks")
      .update({ status_id: statusId, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo mover la tarea: ${error.message}`);
    }
  }

  /** Archivar es del dueño; lo hace cumplir el trigger de la base. */
  async archive(organizationId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from("tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo archivar la tarea: ${error.message}`);
    }
  }

  /** Deja la tarea con exactamente estas etiquetas. */
  async setTags(
    organizationId: string,
    taskId: string,
    tagIds: string[],
  ): Promise<void> {
    const { data, error: read } = await this.supabase
      .from("task_tags")
      .select("tag_id")
      .eq("task_id", taskId)
      .eq("organization_id", organizationId)
      .overrideTypes<{ tag_id: string }[]>();

    if (read) {
      throw new Error(`No se pudieron leer las etiquetas: ${read.message}`);
    }

    const known = new Set((data ?? []).map((row) => row.tag_id));
    const fresh = tagIds.filter((id) => !known.has(id));
    if (fresh.length === 0) return;

    const { error } = await this.supabase.from("task_tags").insert(
      fresh.map((tagId) => ({
        task_id: taskId,
        tag_id: tagId,
        organization_id: organizationId,
      })),
    );

    if (error) {
      throw new Error(`No se pudieron aplicar las etiquetas: ${error.message}`);
    }
  }

  /**
   * Vincula la tarea con otro registro.
   *
   * En KAM-15 la única vía que llega aquí es *Crear tarea para este pedido*, y
   * el único tipo escrito es `order`. La existencia del registro apuntado la
   * comprueba un trigger, porque una referencia polimórfica no puede llevar
   * llave foránea.
   */
  async link(
    organizationId: string,
    taskId: string,
    entityType: TaskLinkType,
    entityId: string,
  ): Promise<void> {
    const { error } = await this.supabase.from("task_links").insert({
      task_id: taskId,
      organization_id: organizationId,
      entity_type: entityType,
      entity_id: entityId,
    });

    if (error) {
      throw new Error(`No se pudo vincular la tarea: ${error.message}`);
    }
  }

  /**
   * Los vínculos de una tarea, resueltos contra sus destinos.
   *
   * Una consulta **por tipo presente**, nunca una por vínculo: una tarea con
   * seis vínculos hace como mucho cinco consultas (D2).
   *
   * Los de tipo `asset` se omiten por completo para quien no es la persona
   * dueña —ni resueltos ni como entrada sin acceso—, porque `asset_details`
   * está reservada y una entrada rotulada le diría al ayudante cuántos activos
   * hay (D9). RLS ya devolvería cero filas; esto es lo que evita rendir el
   * hueco que las delata.
   */
  async links(
    organizationId: string,
    taskId: string,
    isOwner: boolean,
  ): Promise<ResolvedTaskLink[]> {
    const { data, error } = await this.supabase
      .from("task_links")
      .select("entity_type, entity_id")
      .eq("organization_id", organizationId)
      .eq("task_id", taskId)
      .is("archived_at", null)
      .overrideTypes<{ entity_type: TaskLinkType; entity_id: string }[]>();

    if (error) {
      throw new Error(`No se pudieron cargar los vínculos: ${error.message}`);
    }

    const rows = (data ?? []).filter(
      (row) => isOwner || row.entity_type !== "asset",
    );
    if (rows.length === 0) return [];

    const byType = new Map<TaskLinkType, string[]>();
    for (const row of rows) {
      byType.set(row.entity_type, [
        ...(byType.get(row.entity_type) ?? []),
        row.entity_id,
      ]);
    }

    const resolved = new Map<string, ResolvedTaskLink>();

    for (const [entityType, ids] of byType) {
      for (const link of await this.resolveTargets(
        organizationId,
        entityType,
        ids,
      )) {
        resolved.set(`${link.entityType}:${link.entityId}`, link);
      }
    }

    // El orden de `task_links` manda: el vínculo más antiguo primero, que es
    // el que originó la tarea cuando vino de *Crear tarea para este pedido*.
    return rows
      .map((row) => resolved.get(`${row.entity_type}:${row.entity_id}`))
      .filter((link): link is ResolvedTaskLink => link !== undefined);
  }

  /** Resuelve los destinos de un solo tipo, en una sola consulta. */
  private async resolveTargets(
    organizationId: string,
    entityType: TaskLinkType,
    ids: string[],
  ): Promise<ResolvedTaskLink[]> {
    if (entityType === "order") {
      const { data } = await this.supabase
        .from("orders")
        .select("id, code, archived_at, status:statuses (name)")
        .eq("organization_id", organizationId)
        .in("id", ids)
        .overrideTypes<
          {
            id: string;
            code: number | null;
            archived_at: string | null;
            status: { name: string } | null;
          }[]
        >();

      return (data ?? []).map((row) => ({
        entityType,
        entityId: row.id,
        label: row.code === null ? "Pedido sin número" : `Pedido #${row.code}`,
        statusName: row.status?.name ?? null,
        archived: row.archived_at !== null,
      }));
    }

    if (entityType === "expense") {
      const { data } = await this.supabase
        .from("expenses")
        .select("id, kind, amount, occurred_at, note, archived_at")
        .eq("organization_id", organizationId)
        .in("id", ids)
        .overrideTypes<
          {
            id: string;
            kind: string;
            amount: number | null;
            occurred_at: string;
            note: string | null;
            archived_at: string | null;
          }[]
        >();

      return (data ?? []).map((row) => ({
        entityType,
        entityId: row.id,
        label:
          row.note ?? (row.kind === "purchase" ? "Compra" : "Gasto"),
        statusName: null,
        archived: row.archived_at !== null,
      }));
    }

    // Ítem, activo y contacto se resuelven por nombre. El activo vive en
    // `items`: su `entity_id` es el `item_id` de `asset_details`.
    const table = entityType === "contact" ? "contacts" : "items";
    const { data } = await this.supabase
      .from(table)
      .select("id, name, archived_at")
      .eq("organization_id", organizationId)
      .in("id", ids)
      .overrideTypes<
        { id: string; name: string; archived_at: string | null }[]
      >();

    return (data ?? []).map((row) => ({
      entityType,
      entityId: row.id,
      label: row.name,
      statusName: null,
      archived: row.archived_at !== null,
    }));
  }

  /**
   * Quita un vínculo.
   *
   * Retira la relación y nada más: el registro apuntado queda intacto, sin
   * archivar y sin modificar.
   *
   * **Archiva la fila, no la borra** (convención nº 3): `task_links` no tiene
   * política `DELETE` para nadie. La unicidad es parcial sobre las vigentes,
   * así que el mismo destino se puede volver a vincular después sin chocar
   * contra su propio historial.
   */
  async unlink(
    organizationId: string,
    taskId: string,
    entityType: TaskLinkType,
    entityId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("task_links")
      .update({ archived_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("task_id", taskId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .is("archived_at", null);

    if (error) {
      throw new Error(`No se pudo quitar el vínculo: ${error.message}`);
    }
  }

  /**
   * El buscador único: un término, cinco tipos, un solo listado.
   *
   * La normalización es la misma que usa el resto del sistema
   * (`normalizeForSearch`), porque las tablas comparan contra
   * `immutable_unaccent(lower(name))` y una segunda regla aquí daría
   * resultados distintos a los del catálogo con el mismo término.
   *
   * Los archivados no se ofrecen —vincular a algo retirado es empezar roto— y
   * los activos solo se ofrecen a la persona dueña (D9).
   */
  async searchLinkTargets(
    organizationId: string,
    term: string,
    isOwner: boolean,
  ): Promise<LinkTarget[]> {
    const needle = normalizeForSearch(term);
    if (needle === "") return [];

    const pattern = `%${needle}%`;
    const results: LinkTarget[] = [];

    const { data: orders } = await this.supabase
      .from("orders")
      .select("id, code, contact:contacts (name)")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .limit(SEARCH_LIMIT)
      .overrideTypes<
        { id: string; code: number | null; contact: { name: string } | null }[]
      >();

    for (const row of orders ?? []) {
      const label = row.code === null ? "Pedido" : `Pedido #${row.code}`;
      const customer = row.contact?.name ?? null;
      if (
        matchesSearch(label, term) ||
        (customer !== null && matchesSearch(customer, term))
      ) {
        results.push({
          entityType: "order",
          entityId: row.id,
          label,
          hint: customer,
        });
      }
    }

    const { data: contacts } = await this.supabase
      .from("contacts")
      .select("id, name, is_supplier, is_customer")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("search_name", pattern)
      .limit(SEARCH_LIMIT)
      .overrideTypes<
        {
          id: string;
          name: string;
          is_supplier: boolean;
          is_customer: boolean;
        }[]
      >();

    for (const row of contacts ?? []) {
      results.push({
        entityType: "contact",
        entityId: row.id,
        label: row.name,
        hint: row.is_supplier ? "Proveedor" : row.is_customer ? "Cliente" : null,
      });
    }

    const { data: items } = await this.supabase
      .from("items")
      .select("id, name, kind")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("search_name", pattern)
      .limit(SEARCH_LIMIT)
      .overrideTypes<{ id: string; name: string; kind: string }[]>();

    // Un ítem de tipo activo se ofrece como activo solo si quien busca es la
    // persona dueña; para el resto sigue siendo un ítem del catálogo, que es
    // lo que ya podían ver antes de esta tarea.
    for (const row of items ?? []) {
      if (row.kind === "asset" && !isOwner) continue;
      results.push({
        entityType: row.kind === "asset" ? "asset" : "item",
        entityId: row.id,
        label: row.name,
        hint:
          row.kind === "asset"
            ? "Activo"
            : row.kind === "supply"
              ? "Insumo"
              : "Producto",
      });
    }

    const { data: expenses } = await this.supabase
      .from("expenses")
      .select("id, kind, note, occurred_at")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .not("note", "is", null)
      .ilike("note", pattern)
      .limit(SEARCH_LIMIT)
      .overrideTypes<
        { id: string; kind: string; note: string | null; occurred_at: string }[]
      >();

    for (const row of expenses ?? []) {
      results.push({
        entityType: "expense",
        entityId: row.id,
        label: row.note ?? "Egreso",
        hint: row.kind === "purchase" ? "Compra" : "Gasto",
      });
    }

    return results;
  }

  /**
   * Las tareas que referencian un registro: el otro lado del vínculo.
   *
   * Una sola consulta. El filtrado por rol y por línea lo hace RLS sobre
   * `tasks`, y `task_links` hereda de ella con su `exists` (D4). Repetir esa
   * condición en TypeScript sería el segundo sitio donde desincronizarse.
   */
  async relatedTasks(
    organizationId: string,
    entityType: TaskLinkType,
    entityId: string,
  ): Promise<RelatedTask[]> {
    const { data, error } = await this.supabase
      .from("task_links")
      .select(
        "task:tasks (id, title, due_at, closed_at, archived_at, status:statuses (name))",
      )
      .eq("organization_id", organizationId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .is("archived_at", null)
      .overrideTypes<
        {
          task: {
            id: string;
            title: string;
            due_at: string | null;
            closed_at: string | null;
            archived_at: string | null;
            status: { name: string } | null;
          } | null;
        }[]
      >();

    if (error) {
      throw new Error(
        `No se pudieron cargar las tareas relacionadas: ${error.message}`,
      );
    }

    return (data ?? [])
      .map((row) => row.task)
      .filter((task): task is NonNullable<typeof task> => task !== null)
      .filter((task) => task.archived_at === null)
      .map((task) => ({
        id: task.id,
        title: task.title,
        statusName: task.status?.name ?? null,
        dueAt: task.due_at,
        closedAt: task.closed_at,
      }));
  }

  /**
   * Cuántos vínculos y cuántos entregables tiene cada tarea del tablero.
   *
   * Dos consultas para todo el tablero, no dos por tarjeta. Nada de esto se
   * almacena (convención nº 4): se cuenta al leer, y la tarjeta solo necesita
   * saber si hay o no hay.
   */
  async boardBadges(
    organizationId: string,
    taskIds: string[],
  ): Promise<
    Map<string, { links: number; deliverables: number; pending: number }>
  > {
    const badges = new Map<
      string,
      { links: number; deliverables: number; pending: number }
    >();
    if (taskIds.length === 0) return badges;

    const [{ data: links }, { data: deliverables }] = await Promise.all([
      this.supabase
        .from("task_links")
        .select("task_id")
        .eq("organization_id", organizationId)
        .in("task_id", taskIds)
        .is("archived_at", null)
        .overrideTypes<{ task_id: string }[]>(),
      this.supabase
        .from("task_deliverables")
        .select("task_id, fulfilled_at")
        .eq("organization_id", organizationId)
        .in("task_id", taskIds)
        .is("archived_at", null)
        .overrideTypes<{ task_id: string; fulfilled_at: string | null }[]>(),
    ]);

    const blank = { links: 0, deliverables: 0, pending: 0 };

    for (const row of links ?? []) {
      const current = badges.get(row.task_id) ?? blank;
      badges.set(row.task_id, { ...current, links: current.links + 1 });
    }
    for (const row of deliverables ?? []) {
      const current = badges.get(row.task_id) ?? blank;
      badges.set(row.task_id, {
        ...current,
        deliverables: current.deliverables + 1,
        // Lo que decide si el asistente se abre al soltar en una columna
        // final: no cuántos hay, sino cuántos quedan sin cumplir (D7).
        pending: current.pending + (row.fulfilled_at === null ? 1 : 0),
      });
    }

    return badges;
  }

  /** Los entregables declarados de una tarea, cumplidos y pendientes. */
  async deliverables(
    organizationId: string,
    taskId: string,
  ): Promise<Deliverable[]> {
    const { data, error } = await this.supabase
      .from("task_deliverables")
      .select("id, task_id, deliverable_type, fulfilled_type, fulfilled_id, fulfilled_at")
      .eq("organization_id", organizationId)
      .eq("task_id", taskId)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .overrideTypes<
        {
          id: string;
          task_id: string;
          deliverable_type: DeliverableType;
          fulfilled_type: string | null;
          fulfilled_id: string | null;
          fulfilled_at: string | null;
        }[]
      >();

    if (error) {
      throw new Error(`No se pudieron cargar los entregables: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      taskId: row.task_id,
      deliverableType: row.deliverable_type,
      fulfilledType: row.fulfilled_type,
      fulfilledId: row.fulfilled_id,
      fulfilledAt: row.fulfilled_at,
    }));
  }

  /**
   * Declara un entregable esperado.
   *
   * El `unique (task_id, deliverable_type)` de la base impide el segundo del
   * mismo tipo; aquí no se comprueba antes para no dejar una ventana entre la
   * comprobación y la escritura.
   */
  async declareDeliverable(
    organizationId: string,
    taskId: string,
    type: DeliverableType,
  ): Promise<void> {
    const { error } = await this.supabase.from("task_deliverables").insert({
      task_id: taskId,
      organization_id: organizationId,
      deliverable_type: type,
    });

    if (error) {
      throw new Error(`No se pudo declarar el entregable: ${error.message}`);
    }
  }

  /**
   * Retira un entregable declarado y aún no cumplido.
   *
   * Archiva la fila, no la borra (convención nº 3). El `is("fulfilled_at",
   * null)` es lo que hace que retirar uno ya cumplido no toque ninguna fila:
   * lo creado no se deshace desde aquí.
   */
  async withdrawDeliverable(
    organizationId: string,
    taskId: string,
    type: DeliverableType,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("task_deliverables")
      .update({ archived_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("task_id", taskId)
      .eq("deliverable_type", type)
      .is("fulfilled_at", null)
      .is("archived_at", null);

    if (error) {
      throw new Error(`No se pudo retirar el entregable: ${error.message}`);
    }
  }

  /** Las personas a las que se puede asignar una tarea. */
  async assignees(
    organizationId: string,
  ): Promise<{ userId: string; displayName: string | null }[]> {
    const { data, error } = await this.supabase
      .from("memberships")
      .select("user_id, display_name")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .overrideTypes<{ user_id: string; display_name: string | null }[]>();

    if (error) {
      throw new Error(`No se pudo cargar el equipo: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
    }));
  }
}

export type { Tag };
