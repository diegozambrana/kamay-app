import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES } from "./defaults";
import { planAssignment, planScheduled, planStatusChange } from "./plan";
import type {
  NotificationPreferences,
  OrganizationPlanInput,
  PlannableTask,
} from "./types";

/**
 * KAM-17 · La decisión de a quién avisar.
 *
 * Escenarios del delta spec `notifications` — requisitos "El resumen diario es
 * un solo aviso por persona", "El resumen llega a la hora que cada persona
 * eligió", "Un tipo apagado no se genera ni se envía", "Sin fecha límite no
 * hay aviso de vencimiento" y "Los avisos de tarea cubren asignación,
 * revisión, vencimiento y estancamiento".
 *
 * Toda la regla anti-ruido se comprueba aquí, con literales y sin base de
 * datos: es el motivo por el que `plan()` es una función pura (design D2).
 */

const ORG = "org-1";
const ANA = "user-ana";
const BRUNO = "user-bruno";
const HOY = "2026-09-08";

function prefs(
  overrides: Partial<NotificationPreferences> = {},
): NotificationPreferences {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

function task(overrides: Partial<PlannableTask> = {}): PlannableTask {
  return {
    id: "t1",
    organizationId: ORG,
    title: "Set de 6 tazas",
    dueDate: HOY,
    assigneeId: ANA,
    statusKind: "initial",
    statusSince: null,
    closed: false,
    ...overrides,
  };
}

function input(
  overrides: Partial<OrganizationPlanInput> = {},
): OrganizationPlanInput {
  return {
    organizationId: ORG,
    today: HOY,
    localHour: DEFAULT_PREFERENCES.dailySummaryHour,
    tasks: [],
    members: [{ userId: ANA, preferences: prefs() }],
    ...overrides,
  };
}

function ofType(planned: ReturnType<typeof planScheduled>, type: string) {
  return planned.filter((notification) => notification.type === type);
}

describe("planScheduled · resumen diario", () => {
  it("cinco tareas que vencen hoy producen un solo aviso de resumen", () => {
    // Criterio de aceptación nº 1 del backlog, y la razón de ser del diseño.
    const planned = planScheduled(
      input({
        tasks: [1, 2, 3, 4, 5].map((n) =>
          task({ id: `t${n}`, title: `Tarea ${n}` }),
        ),
      }),
    );

    const resumenes = ofType(planned, "due_summary");
    expect(resumenes).toHaveLength(1);
    expect(resumenes[0].title).toContain("5");
  });

  it("el resumen menciona las cinco en su cuerpo", () => {
    const planned = planScheduled(
      input({
        tasks: [1, 2, 3, 4, 5].map((n) =>
          task({ id: `t${n}`, title: `Tarea ${n}` }),
        ),
      }),
    );

    const [resumen] = ofType(planned, "due_summary");
    for (const n of [1, 2, 3, 4, 5]) {
      expect(resumen.body).toContain(`Tarea ${n}`);
    }
  });

  it("sin nada que vencer no se crea ningún resumen", () => {
    const planned = planScheduled(
      input({ tasks: [task({ dueDate: "2026-12-01" })] }),
    );

    expect(ofType(planned, "due_summary")).toHaveLength(0);
  });

  it("una tarea cerrada no entra en el resumen", () => {
    const planned = planScheduled(input({ tasks: [task({ closed: true })] }));

    expect(planned).toHaveLength(0);
  });

  it("el resumen solo cuenta las tareas de quien lo recibe", () => {
    const planned = planScheduled(
      input({
        tasks: [task({ id: "t1" }), task({ id: "t2", assigneeId: BRUNO })],
        members: [
          { userId: ANA, preferences: prefs() },
          { userId: BRUNO, preferences: prefs() },
        ],
      }),
    );

    const resumenes = ofType(planned, "due_summary");
    expect(resumenes).toHaveLength(2);
    for (const resumen of resumenes) {
      expect(resumen.title).toContain("1");
    }
  });
});

describe("planScheduled · la hora es la local de la organización", () => {
  it("cada persona recibe el suyo a su propia hora", () => {
    const tasks = [task({ id: "t1" }), task({ id: "t2", assigneeId: BRUNO })];
    const members = [
      { userId: ANA, preferences: prefs({ dailySummaryHour: 7 }) },
      { userId: BRUNO, preferences: prefs({ dailySummaryHour: 18 }) },
    ];

    const alasSiete = planScheduled(input({ tasks, members, localHour: 7 }));
    const alasSeis = planScheduled(input({ tasks, members, localHour: 18 }));

    expect(ofType(alasSiete, "due_summary").map((n) => n.userId)).toEqual([ANA]);
    expect(ofType(alasSeis, "due_summary").map((n) => n.userId)).toEqual([
      BRUNO,
    ]);
  });

  it("a una hora que nadie eligió no se envía ningún resumen", () => {
    const planned = planScheduled(
      input({ tasks: [task()], localHour: 3 }),
    );

    expect(ofType(planned, "due_summary")).toHaveLength(0);
  });

  it("la hora que decide es la que llega en la entrada, no la del sistema", () => {
    // `planScheduled` no lee ningún reloj: quien resuelve la hora local de la
    // organización es el manejador de ruta, y aquí solo se compara. Es lo que
    // hace comprobable «la zona horaria manda» sin viajar en el tiempo.
    const conHora = (localHour: number) =>
      ofType(
        planScheduled(
          input({
            tasks: [task()],
            localHour,
            members: [
              { userId: ANA, preferences: prefs({ dailySummaryHour: 8 }) },
            ],
          }),
        ),
        "due_summary",
      );

    expect(conHora(8)).toHaveLength(1);
    expect(conHora(9)).toHaveLength(0);
  });
});

describe("planScheduled · preferencias", () => {
  it("un tipo apagado no se genera", () => {
    const planned = planScheduled(
      input({
        tasks: [task({ dueDate: "2026-09-01" })],
        members: [
          { userId: ANA, preferences: prefs({ task_overdue: false }) },
        ],
      }),
    );

    expect(ofType(planned, "task_overdue")).toHaveLength(0);
  });

  it("apagar uno no afecta a los demás", () => {
    const planned = planScheduled(
      input({
        tasks: [task({ dueDate: "2026-09-01" })],
        members: [{ userId: ANA, preferences: prefs({ due_summary: false }) }],
      }),
    );

    expect(ofType(planned, "due_summary")).toHaveLength(0);
    expect(ofType(planned, "task_overdue")).toHaveLength(1);
  });

  it("el apagado es de quien lo hace, no de la organización", () => {
    const planned = planScheduled(
      input({
        tasks: [
          task({ id: "t1", dueDate: "2026-09-01" }),
          task({ id: "t2", dueDate: "2026-09-01", assigneeId: BRUNO }),
        ],
        members: [
          { userId: ANA, preferences: prefs({ task_overdue: false }) },
          { userId: BRUNO, preferences: prefs() },
        ],
      }),
    );

    expect(ofType(planned, "task_overdue").map((n) => n.userId)).toEqual([
      BRUNO,
    ]);
  });
});

describe("planScheduled · sin fecha límite no hay aviso", () => {
  it("una tarea sin fecha no genera nada y no entra en ningún resumen", () => {
    const planned = planScheduled(
      input({ tasks: [task({ dueDate: null })] }),
    );

    expect(planned).toHaveLength(0);
  });

  it("ponerle una fecha pasada la hace avisar como cualquier otra", () => {
    const planned = planScheduled(
      input({ tasks: [task({ dueDate: "2026-09-01" })] }),
    );

    expect(ofType(planned, "task_overdue")).toHaveLength(1);
  });
});

describe("planScheduled · vencidas y estancadas", () => {
  it("una tarea vencida avisa una vez, con la fecha límite en su llave", () => {
    const planned = planScheduled(
      input({ tasks: [task({ dueDate: "2026-09-01" })] }),
    );

    const [vencida] = ofType(planned, "task_overdue");
    expect(vencida.entityType).toBe("task");
    expect(vencida.entityId).toBe("t1");
    expect(vencida.dedupeKey).toBe("task_overdue:t1:2026-09-01");
  });

  it("una tarea cerrada no genera ningún aviso nuevo", () => {
    const planned = planScheduled(
      input({
        tasks: [task({ dueDate: "2026-09-01", closed: true })],
      }),
    );

    expect(planned).toHaveLength(0);
  });

  it("una tarea parada en curso más del umbral se avisa como estancada", () => {
    const planned = planScheduled(
      input({
        tasks: [
          task({
            dueDate: null,
            statusKind: "in_progress",
            statusSince: "2026-08-20T09:00:00.000Z",
          }),
        ],
      }),
    );

    expect(ofType(planned, "task_stalled")).toHaveLength(1);
  });

  it("una tarea recién movida no está estancada", () => {
    const planned = planScheduled(
      input({
        tasks: [
          task({
            dueDate: null,
            statusKind: "in_progress",
            statusSince: "2026-09-07T09:00:00.000Z",
          }),
        ],
      }),
    );

    expect(ofType(planned, "task_stalled")).toHaveLength(0);
  });

  it("solo se estanca lo que está en curso, no lo que espera", () => {
    // Una tarea en revisión lleva semanas parada por definición: avisar de eso
    // sería avisar de que el sistema funciona.
    const planned = planScheduled(
      input({
        tasks: [
          task({
            dueDate: null,
            statusKind: "waiting",
            statusSince: "2026-08-01T09:00:00.000Z",
          }),
        ],
      }),
    );

    expect(ofType(planned, "task_stalled")).toHaveLength(0);
  });
});

describe("planScheduled · lo que no genera", () => {
  it("nunca produce avisos de insumo bajo mínimo", () => {
    // El tipo existe en el catálogo y la bandeja sabe rendirlo, pero su
    // generador es de KAM-18: aquí no hay nada de donde derivarlo.
    const planned = planScheduled(
      input({
        tasks: [task({ dueDate: "2026-09-01" }), task({ id: "t2" })],
      }),
    );

    expect(ofType(planned, "stock_below_min")).toHaveLength(0);
  });

  it("la asignación y la revisión no salen del trabajo programado", () => {
    // Son reacciones a un acto concreto y las deciden las acciones (design D5):
    // esperar a la próxima pasada horaria para avisar de una asignación sería
    // absurdo.
    const planned = planScheduled(
      input({ tasks: [task({ dueDate: "2026-09-01" })] }),
    );

    expect(ofType(planned, "task_assigned")).toHaveLength(0);
    expect(ofType(planned, "task_review")).toHaveLength(0);
  });

  it("una tarea sin responsable no avisa a nadie", () => {
    const planned = planScheduled(
      input({ tasks: [task({ assigneeId: null, dueDate: "2026-09-01" })] }),
    );

    expect(planned).toHaveLength(0);
  });
});

describe("planAssignment", () => {
  it("asignar a otra persona la avisa", () => {
    const planned = planAssignment({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas" },
      assigneeId: BRUNO,
      actorId: ANA,
      preferences: prefs(),
    });

    expect(planned).toHaveLength(1);
    expect(planned[0].userId).toBe(BRUNO);
    expect(planned[0].entityId).toBe("t1");
  });

  it("asignarse a uno mismo no avisa", () => {
    const planned = planAssignment({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas" },
      assigneeId: ANA,
      actorId: ANA,
      preferences: prefs(),
    });

    expect(planned).toHaveLength(0);
  });

  it("quitar el responsable no avisa a nadie", () => {
    const planned = planAssignment({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas" },
      assigneeId: null,
      actorId: ANA,
      preferences: prefs(),
    });

    expect(planned).toHaveLength(0);
  });

  it("con el tipo apagado no se genera", () => {
    const planned = planAssignment({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas" },
      assigneeId: BRUNO,
      actorId: ANA,
      preferences: prefs({ task_assigned: false }),
    });

    expect(planned).toHaveLength(0);
  });

  it("sin preferencias conocidas se aplica la omisión y sí avisa", () => {
    const planned = planAssignment({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas" },
      assigneeId: BRUNO,
      actorId: ANA,
      preferences: null,
    });

    expect(planned).toHaveLength(1);
  });
});

describe("planStatusChange", () => {
  it("entrar en un estado de tipo waiting avisa al responsable", () => {
    const planned = planStatusChange({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas", assigneeId: ANA },
      statusId: "s-revision",
      statusKind: "waiting",
      actorId: BRUNO,
      preferences: prefs(),
    });

    expect(planned).toHaveLength(1);
    expect(planned[0].type).toBe("task_review");
    expect(planned[0].userId).toBe(ANA);
  });

  it("el nombre del estado no decide nada: decide su tipo", () => {
    // Renombrar «En revisión» a «Para revisar», «QA» o cualquier otra cosa no
    // cambia el tipo declarado, y el aviso sigue saliendo (convención nº 5).
    // Lo que no avisa es un estado en curso, se llame como se llame.
    const revisión = planStatusChange({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas", assigneeId: ANA },
      statusId: "s-como-se-llame",
      statusKind: "waiting",
      actorId: BRUNO,
      preferences: prefs(),
    });

    const enCurso = planStatusChange({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas", assigneeId: ANA },
      statusId: "s-llamado-en-revision",
      statusKind: "in_progress",
      actorId: BRUNO,
      preferences: prefs(),
    });

    expect(revisión).toHaveLength(1);
    expect(enCurso).toHaveLength(0);
  });

  it("moverla uno mismo no se avisa a uno mismo", () => {
    const planned = planStatusChange({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas", assigneeId: ANA },
      statusId: "s-revision",
      statusKind: "waiting",
      actorId: ANA,
      preferences: prefs(),
    });

    expect(planned).toHaveLength(0);
  });

  it("una tarea sin responsable no avisa a nadie", () => {
    const planned = planStatusChange({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas", assigneeId: null },
      statusId: "s-revision",
      statusKind: "waiting",
      actorId: ANA,
      preferences: prefs(),
    });

    expect(planned).toHaveLength(0);
  });

  it("con el tipo apagado no se genera", () => {
    const planned = planStatusChange({
      organizationId: ORG,
      task: { id: "t1", title: "Set de 6 tazas", assigneeId: ANA },
      statusId: "s-revision",
      statusKind: "waiting",
      actorId: BRUNO,
      preferences: prefs({ task_review: false }),
    });

    expect(planned).toHaveLength(0);
  });
});
