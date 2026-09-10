import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { TaskService } from "@/services/tasks/task-service";

import { GEEKO, signIn } from "./fair-support";

/**
 * KAM-21 · El cierre con entregables contra la base real.
 *
 * Lo que esto añade sobre lo unitario y lo pgTAP: recorre el camino completo
 * —RPC → RLS → servicio— y comprueba con consultas independientes que cada
 * entregable dejó su registro, su cumplimiento, su vínculo y su entrada de
 * bitácora. Repetir aquí la lógica de la RPC no probaría nada; estas
 * comprobaciones llegan por otro camino.
 *
 * Escenarios del delta spec `task-links-deliverables`:
 * - "El registro creado queda enlazado desde la tarea y visible en la
 *   bitácora" → «La tarea aparece en el registro creado», «No hay un historial
 *   de entregables aparte», «Un entregable cumplido no se vuelve a ofrecer».
 */

let db: SupabaseClient;
let tasks: TaskService;
let finalStatusId: string;

const ORG = GEEKO.organizationId;

beforeAll(async () => {
  db = await signIn();
  tasks = new TaskService(db);

  const { data } = await db
    .from("statuses")
    .select("id")
    .eq("organization_id", ORG)
    .eq("flow", "task")
    .eq("kind", "final")
    .is("archived_at", null)
    .limit(1)
    .single();

  finalStatusId = (data as { id: string }).id;
});

/** Una tarea nueva por prueba: cada una crea lo suyo y no pisa a las demás. */
async function nuevaTarea(title: string): Promise<string> {
  const { data, error } = await db
    .from("tasks")
    .insert({
      organization_id: ORG,
      business_line_id: GEEKO.alfareria,
      title,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

describe("crear entregables al cerrar", () => {
  it("un producto queda creado, cumplido, vinculado y en la bitácora", async () => {
    const taskId = await nuevaTarea("Set de 6 tazas · integración");
    await tasks.declareDeliverable(ORG, taskId, "product");

    const newId = crypto.randomUUID();
    const { error } = await db.rpc("close_task_with_deliverables", {
      p_task_id: taskId,
      p_deliverables: [
        {
          deliverable_type: "product",
          new_id: newId,
          payload: {
            name: "Taza celadón · integración",
            business_line_id: GEEKO.alfareria,
          },
          attachments: [],
        },
      ],
      p_status_id: finalStatusId,
    });
    expect(error).toBeNull();

    // El registro existe, por consulta directa y no por lo que dijo la RPC.
    const { data: item } = await db
      .from("items")
      .select("id, kind, name")
      .eq("id", newId)
      .single();
    expect(item).toMatchObject({ kind: "product", name: "Taza celadón · integración" });

    // El entregable registra qué se creó.
    const deliverables = await tasks.deliverables(ORG, taskId);
    expect(deliverables[0]).toMatchObject({
      deliverableType: "product",
      fulfilledType: "item",
      fulfilledId: newId,
    });
    expect(deliverables[0].fulfilledAt).not.toBeNull();

    // Y queda vinculado desde la tarea.
    const links = await tasks.links(ORG, taskId, true);
    expect(links.map((l) => l.entityId)).toContain(newId);

    // «La tarea aparece en el registro creado»: el vínculo se lee del otro lado.
    const related = await tasks.relatedTasks(ORG, "item", newId);
    expect(related.map((t) => t.id)).toContain(taskId);

    // «No hay un historial de entregables aparte»: la creación está en la
    // bitácora del sistema, y no existe ninguna tabla propia.
    const { data: log } = await db
      .from("activity_log")
      .select("action")
      .eq("table_name", "items")
      .eq("record_id", newId);
    expect(log).toHaveLength(1);
    expect((log as { action: string }[])[0].action).toBe("created");

    // La tarea quedó cerrada y sin marca, porque sí se creó algo.
    const task = await tasks.getById(ORG, taskId);
    expect(task?.closedAt).not.toBeNull();
    expect(task?.closedWithoutDeliverables).toBe(false);
  });

  it("un proveedor nace con su rol y vinculado a la tarea", async () => {
    const taskId = await nuevaTarea("Buscar proveedor de arcilla · integración");
    await tasks.declareDeliverable(ORG, taskId, "supplier");

    const newId = crypto.randomUUID();
    const { error } = await db.rpc("close_task_with_deliverables", {
      p_task_id: taskId,
      p_deliverables: [
        {
          deliverable_type: "supplier",
          new_id: newId,
          payload: { name: "Arcillas del Sur · integración" },
          attachments: [],
        },
      ],
      p_status_id: finalStatusId,
    });
    expect(error).toBeNull();

    const { data: contact } = await db
      .from("contacts")
      .select("id, is_supplier")
      .eq("id", newId)
      .single();
    expect(contact).toMatchObject({ is_supplier: true });

    const links = await tasks.links(ORG, taskId, true);
    expect(links.find((l) => l.entityId === newId)?.entityType).toBe("contact");
  });

  it("un gasto se crea con su categoría y su importe", async () => {
    const taskId = await nuevaTarea("Cargar gastos de feria · integración");
    await tasks.declareDeliverable(ORG, taskId, "expenses");

    const { data: category } = await db
      .from("expense_categories")
      .select("id")
      .eq("organization_id", ORG)
      .limit(1)
      .single();

    const newId = crypto.randomUUID();
    const { error } = await db.rpc("close_task_with_deliverables", {
      p_task_id: taskId,
      p_deliverables: [
        {
          deliverable_type: "expenses",
          new_id: newId,
          payload: {
            business_line_id: GEEKO.alfareria,
            note: "Stand de feria · integración",
            amount: "150",
            expense_category_id: (category as { id: string }).id,
            items: [],
          },
          attachments: [],
        },
      ],
      p_status_id: finalStatusId,
    });
    expect(error).toBeNull();

    const { data: expense } = await db
      .from("expenses")
      .select("id, kind, amount")
      .eq("id", newId)
      .single();
    expect(expense).toMatchObject({ kind: "expense" });
    expect(Number((expense as { amount: number }).amount)).toBe(150);
  });

  // «Un entregable cumplido no se vuelve a ofrecer»
  it("reabrir y volver a cerrar no crea el entregable dos veces", async () => {
    const taskId = await nuevaTarea("No duplicar · integración");
    await tasks.declareDeliverable(ORG, taskId, "product");

    const first = crypto.randomUUID();
    await db.rpc("close_task_with_deliverables", {
      p_task_id: taskId,
      p_deliverables: [
        {
          deliverable_type: "product",
          new_id: first,
          payload: { name: "Primero · integración", business_line_id: GEEKO.alfareria },
          attachments: [],
        },
      ],
      p_status_id: finalStatusId,
    });

    // Se reabre y se vuelve a cerrar pidiendo lo mismo.
    const { data: initial } = await db
      .from("statuses")
      .select("id")
      .eq("organization_id", ORG)
      .eq("flow", "task")
      .eq("kind", "initial")
      .limit(1)
      .single();

    await db
      .from("tasks")
      .update({ status_id: (initial as { id: string }).id })
      .eq("id", taskId);

    const second = crypto.randomUUID();
    await db.rpc("close_task_with_deliverables", {
      p_task_id: taskId,
      p_deliverables: [
        {
          deliverable_type: "product",
          new_id: second,
          payload: { name: "Segundo · integración", business_line_id: GEEKO.alfareria },
          attachments: [],
        },
      ],
      p_status_id: finalStatusId,
    });

    // El segundo no se creó: el entregable ya estaba cumplido.
    const { data: dup } = await db.from("items").select("id").eq("id", second);
    expect(dup).toHaveLength(0);

    const deliverables = await tasks.deliverables(ORG, taskId);
    expect(deliverables[0].fulfilledId).toBe(first);
  });

  it("cerrar sin crear nada deja la marca, y reabrir la retira", async () => {
    const taskId = await nuevaTarea("Cerrar a secas · integración");
    await tasks.declareDeliverable(ORG, taskId, "product");

    await db.rpc("close_task_with_deliverables", {
      p_task_id: taskId,
      p_deliverables: [],
      p_status_id: finalStatusId,
    });

    expect((await tasks.getById(ORG, taskId))?.closedWithoutDeliverables).toBe(true);

    const { data: initial } = await db
      .from("statuses")
      .select("id")
      .eq("organization_id", ORG)
      .eq("flow", "task")
      .eq("kind", "initial")
      .limit(1)
      .single();

    await db
      .from("tasks")
      .update({ status_id: (initial as { id: string }).id })
      .eq("id", taskId);

    const reopened = await tasks.getById(ORG, taskId);
    expect(reopened?.closedWithoutDeliverables).toBe(false);
    expect(reopened?.closedAt).toBeNull();
  });

  /**
   * Los adjuntos viajan como **objeto copiado**, no como fila compartida
   * (design D6): `attachments` lleva `unique (bucket, storage_path)`, así que
   * dos filas no pueden apuntar al mismo archivo.
   *
   * Aquí se comprueba el extremo que la RPC controla —la fila nueva cuelga del
   * registro creado y su ruta es la del destino—; la copia del objeto en sí la
   * hace `AttachmentService.copyToEntity`, que tiene su prueba unitaria.
   */
  it("el adjunto llega al registro creado con su propia ruta", async () => {
    const taskId = await nuevaTarea("Con foto · integración");
    await tasks.declareDeliverable(ORG, taskId, "product");

    const newId = crypto.randomUUID();
    const copiedPath = `${ORG}/item/${newId}/${crypto.randomUUID()}.webp`;

    const { error } = await db.rpc("close_task_with_deliverables", {
      p_task_id: taskId,
      p_deliverables: [
        {
          deliverable_type: "product",
          new_id: newId,
          payload: { name: "Taza con foto · integración", business_line_id: GEEKO.alfareria },
          attachments: [
            {
              bucket: "attachments",
              storage_path: copiedPath,
              file_name: "taza.webp",
              mime_type: "image/webp",
              size_bytes: "12345",
            },
          ],
        },
      ],
      p_status_id: finalStatusId,
    });
    expect(error).toBeNull();

    const { data: rows } = await db
      .from("attachments")
      .select("entity_type, entity_id, storage_path, file_name")
      .eq("entity_id", newId);

    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({
      entity_type: "item",
      entity_id: newId,
      storage_path: copiedPath,
      file_name: "taza.webp",
    });
    // La ruta cuelga del registro nuevo, no de la tarea de origen.
    expect((rows![0] as { storage_path: string }).storage_path).toContain(
      `/item/${newId}/`,
    );
  });
});
