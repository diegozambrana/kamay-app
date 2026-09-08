import type { SupabaseClient } from "@supabase/supabase-js";

import type { TaskInput } from "@/lib/tasks/schema";
import type { ActivityEntry, Tag, Task, TaskLinkType } from "@/types";

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
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
  task_tags: { tag: { id: string; organization_id: string; name: string } | null }[] | null;
};

/**
 * Las columnas de una tarea. `body_markdown` y `remind_at` las encendió
 * KAM-16, que construye el detalle donde se editan; `closed_without_deliverables`
 * sigue apagada hasta KAM-21, porque nada sabría todavía qué hacer con ella.
 */
const COLUMNS =
  "id, organization_id, business_line_id, status_id, title, body_markdown, " +
  "assignee_id, due_at, remind_at, closed_at, created_by, created_at, archived_at, " +
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

  /**
   * El historial de la tarea. Un solo historial (convención nº 7): todo lo que
   * muestre "qué pasó aquí" lee de `activity_log` y de ninguna otra fuente.
   *
   * Es el mismo método que en pedidos, egresos e ítems, y esa repetición es
   * deliberada: la manera de garantizar que no aparezca una segunda tabla de
   * historial es no escribir nada nuevo.
   *
   * La bitácora solo es legible por el dueño; para el ayudante devuelve vacío
   * por RLS, y el bloque se rinde con su mensaje de lista sin contenido, no
   * con un error.
   */
  async history(organizationId: string, id: string): Promise<ActivityEntry[]> {
    const { data, error } = await this.supabase
      .from("activity_log")
      .select("id, action, actor_id, actor_label, changes, occurred_at")
      .eq("organization_id", organizationId)
      .eq("table_name", "tasks")
      .eq("record_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`No se pudo cargar el historial: ${error.message}`);
    }

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as number,
      action: row.action as ActivityEntry["action"],
      actorId: (row.actor_id as string | null) ?? null,
      actorLabel: (row.actor_label as string | null) ?? null,
      changes: (row.changes as Record<string, unknown> | null) ?? null,
      occurredAt: row.occurred_at as string,
    }));
  }
}

export type { Tag };
