import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { retargetStatusForLine } from "@/lib/tasks/line-change";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { StatusService } from "@/services/configuration/status-service";
import { MembershipService } from "@/services/membership-service";
import { TaskService } from "@/services/tasks/task-service";

import { seedWorkshop, type Workshop } from "./tools-support";

/**
 * KAM-29 · La edición de tarea contra la base real.
 *
 * Tres cosas que solo se pueden demostrar aquí:
 *
 * 1. Que una edición de tres campos deja **un** registro de bitácora con esos
 *    tres y ninguno más. `log_activity` guarda solo lo que cambió, así que la
 *    promesa depende de que la escritura no mencione lo que no se tocó
 *    (design D2) — cosa que ningún doble de prueba puede comprobar.
 * 2. Que cambiar la línea reubica el estado y la tarea queda bajo el juego de
 *    su línea nueva. `assign_initial_task_status` es `before insert`: sin el
 *    remapeo la tarea se quedaría con un estado de la línea vieja.
 * 3. Que RLS deja fuera a quien no alcanza la línea, también para editar.
 *
 * Las etiquetas quedan fuera a propósito: `task_tags` no lleva trigger de
 * auditoría, así que un cambio de etiquetas no aparece —ni aparecerá— en la
 * bitácora (design D10).
 *
 * **Ninguna prueba usa la línea «General»**: es `is_shared`, y la rama (c) de
 * `has_line_access` la da por alcanzable a todo el mundo. Una línea compartida
 * nunca puede quedar fuera del alcance de nadie.
 */
const TIMEOUT = 60_000;

let shop: Workshop;
/** Dos líneas propias, ninguna compartida. */
let origen: string;
let destino: string;
let ownerId: string;

type Cambios = Record<string, { antes: unknown; despues: unknown }>;

/** Los registros de bitácora de una tarea, del más viejo al más nuevo. */
async function historia(
  db: SupabaseClient,
  organizationId: string,
  taskId: string,
): Promise<{ action: string; changes: Cambios }[]> {
  const { data, error } = await db
    .from("activity_log")
    .select("action, changes")
    .eq("organization_id", organizationId)
    .eq("table_name", "tasks")
    .eq("record_id", taskId)
    .order("id", { ascending: true });
  if (error) throw new Error(`bitácora: ${error.message}`);
  return (data ?? []).map((row) => ({
    action: String(row.action),
    changes: (row.changes ?? {}) as Cambios,
  }));
}

async function nuevaTarea(businessLineId: string, title = "Cortar tazas") {
  return new TaskService(shop.owner).create(
    shop.organizationId,
    { title, businessLineId, assigneeId: null, dueDate: "2026-09-25", link: null },
    ownerId,
  );
}

beforeAll(async () => {
  shop = await seedWorkshop("Taller KAM-29");

  const { data } = await shop.owner.auth.getUser();
  ownerId = data.user!.id;

  const lines = new BusinessLineService(shop.owner);
  origen = (
    await lines.create(shop.organizationId, { name: "Sublimación", color: "blue" })
  ).id;
  destino = (
    await lines.create(shop.organizationId, { name: "Alfarería", color: "amber" })
  ).id;

  /**
   * El juego de tareas de una organización recién creada trae solo `initial` y
   * `final`. El remapeo se demuestra con un tipo intermedio, así que el juego
   * de la organización —que ambas líneas heredan— estrena uno.
   */
  const statuses = new StatusService(shop.owner);
  await statuses.create(shop.organizationId, null, "task", {
    name: "Haciendo",
    kind: "in_progress",
    color: "blue",
    isQueue: false,
  });

  /**
   * Alfarería estrena **juego propio**, copiado del de la organización: mismos
   * tipos, ids distintos. Es la situación exacta que rompe sin remapeo.
   *
   * Va por `createOwnSet` porque un juego no puede nacer estado por estado: la
   * base exige inicial y final en la misma transacción.
   */
  await statuses.createOwnSet(shop.organizationId, destino, "task");

  /**
   * Y ahora, **después** de la copia, la organización gana un `waiting`. Así
   * Sublimación lo tiene y Alfarería no, que es lo que hace demostrable el
   * caso sin destino equivalente.
   */
  await statuses.create(shop.organizationId, null, "task", {
    name: "En revisión",
    kind: "waiting",
    color: "amber",
    isQueue: false,
  });
}, TIMEOUT);

describe("una edición es una sola escritura", () => {
  it(
    "tres campos dejan un registro con esos tres y ninguno más",
    async () => {
      const taskId = await nuevaTarea(origen);
      const tasks = new TaskService(shop.owner);

      // Lo que el formulario manda cuando se tocaron exactamente tres campos:
      // los demás llegan `undefined` y no se escriben. El responsable nace
      // siendo quien la creó, así que desasignarlo sí es un cambio.
      await tasks.updateFields(shop.organizationId, taskId, {
        title: "Cortar 8 tazas",
        assigneeId: null,
        dueDate: "2026-10-02",
      });

      const ediciones = (
        await historia(shop.owner, shop.organizationId, taskId)
      ).filter((row) => row.action === "updated");

      expect(ediciones).toHaveLength(1);
      expect(Object.keys(ediciones[0]!.changes).sort()).toEqual([
        "assignee_id",
        "due_at",
        "title",
      ]);
      expect(ediciones[0]!.changes.title).toEqual({
        antes: "Cortar tazas",
        despues: "Cortar 8 tazas",
      });
    },
    TIMEOUT,
  );

  it(
    "un campo que no se tocó no aparece en la bitácora",
    async () => {
      const taskId = await nuevaTarea(origen, "Hornear la primera tanda");

      await new TaskService(shop.owner).updateFields(shop.organizationId, taskId, {
        dueDate: "2026-11-11",
      });

      const ediciones = (
        await historia(shop.owner, shop.organizationId, taskId)
      ).filter((row) => row.action === "updated");

      expect(ediciones).toHaveLength(1);
      expect(Object.keys(ediciones[0]!.changes)).toEqual(["due_at"]);
    },
    TIMEOUT,
  );
});

describe("cambiar la línea reubica el estado", () => {
  it(
    "la tarea queda bajo el juego de su línea nueva, y la bitácora registra ambos cambios",
    async () => {
      const statuses = new StatusService(shop.owner);
      const tasks = new TaskService(shop.owner);
      const taskId = await nuevaTarea(origen, "Tornear el set");

      // La tarea nace en el `initial` de su línea; se la lleva a `in_progress`
      // para que el remapeo tenga un tipo que no sea el inicial.
      const juegoOrigen = await statuses.resolve(shop.organizationId, origen, "task");
      const enCurso = juegoOrigen.find((status) => status.kind === "in_progress")!;
      await tasks.moveToStatus(shop.organizationId, taskId, enCurso.id);

      // Lo que hace la acción: resolver el juego del destino y elegir el
      // primer estado del mismo tipo.
      const juegoDestino = await statuses.resolve(shop.organizationId, destino, "task");
      const retarget = retargetStatusForLine(enCurso, juegoDestino);

      const modelado = juegoDestino.find((status) => status.kind === "in_progress")!;
      expect(retarget).toEqual({ kind: "moved", status: modelado });
      // El juego propio es una copia: mismo tipo, id distinto. Sin remapeo la
      // tarea se quedaría apuntando al estado de Sublimación.
      expect(modelado.id).not.toBe(enCurso.id);

      await tasks.updateFields(shop.organizationId, taskId, {
        businessLineId: destino,
        statusId: modelado.id,
      });

      const despues = await tasks.getById(shop.organizationId, taskId);
      expect(despues?.businessLineId).toBe(destino);
      expect(despues?.statusId).toBe(modelado.id);

      // Y el estado pertenece de verdad al juego de la línea nueva: es lo que
      // hace que la tarea aparezca en una columna de su tablero.
      expect(juegoDestino.map((status) => status.id)).toContain(despues!.statusId);

      // Un solo registro con los dos cambios: escribir `status_id` hace que el
      // trigger lo clasifique como `status_changed`, que nunca se fusiona.
      const mudanza = (await historia(shop.owner, shop.organizationId, taskId)).at(-1)!;
      expect(mudanza.action).toBe("status_changed");
      expect(Object.keys(mudanza.changes).sort()).toEqual([
        "business_line_id",
        "status_id",
      ]);
    },
    TIMEOUT,
  );

  it(
    "sin estado equivalente en la línea nueva no hay destino",
    async () => {
      const statuses = new StatusService(shop.owner);

      const juegoOrigen = await statuses.resolve(shop.organizationId, origen, "task");
      const juegoDestino = await statuses.resolve(shop.organizationId, destino, "task");

      // Sublimación hereda el `waiting` de la organización; Alfarería copió su
      // juego antes de que existiera y no lo tiene.
      const enEspera = juegoOrigen.find((status) => status.kind === "waiting")!;
      expect(enEspera).toBeDefined();
      expect(juegoDestino.some((status) => status.kind === "waiting")).toBe(false);

      expect(retargetStatusForLine(enEspera, juegoDestino)).toEqual({
        kind: "impossible",
      });
    },
    TIMEOUT,
  );
});

describe("lo que la edición no puede tocar", () => {
  it(
    "una tarea archivada no se edita",
    async () => {
      const taskId = await nuevaTarea(origen, "Tarea que se archiva");
      const tasks = new TaskService(shop.owner);

      await tasks.archive(shop.organizationId, taskId);

      await expect(
        tasks.updateFields(shop.organizationId, taskId, { title: "Otro título" }),
      ).rejects.toThrow();

      expect((await tasks.getById(shop.organizationId, taskId))?.title).toBe(
        "Tarea que se archiva",
      );
    },
    TIMEOUT,
  );

  it(
    "el ayudante no alcanza una tarea de una línea que no tiene asignada",
    async () => {
      const taskId = await nuevaTarea(origen, "Tarea fuera del alcance");

      /**
       * Un ayudante **sin líneas declaradas las alcanza todas**
       * (`has_line_access`, rama a): una restricción se declara, su ausencia
       * no es una restricción total. Para dejar la tarea fuera de su alcance
       * hay que declararle otra línea.
       */
      const { data: helper } = await shop.assistant.auth.getUser();
      const { data: fila, error } = await shop.owner
        .from("memberships")
        .select("id")
        .eq("organization_id", shop.organizationId)
        .eq("user_id", helper.user!.id)
        .single();
      if (error) throw new Error(`membresía: ${error.message}`);

      await new MembershipService(shop.owner).setLines(
        shop.organizationId,
        String(fila!.id),
        [destino],
      );

      const asHelper = new TaskService(shop.assistant);
      expect(await asHelper.getById(shop.organizationId, taskId)).toBeNull();

      // Y tampoco la escribe: el `update` no alcanza ninguna fila.
      await asHelper.updateFields(shop.organizationId, taskId, {
        title: "No debería poder",
      });

      expect(
        (await new TaskService(shop.owner).getById(shop.organizationId, taskId))?.title,
      ).toBe("Tarea fuera del alcance");
    },
    TIMEOUT,
  );
});
