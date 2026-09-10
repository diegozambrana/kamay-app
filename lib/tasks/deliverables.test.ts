import { describe, expect, it } from "vitest";

import {
  canDeclare,
  closesWithoutDeliverables,
  declarableTypes,
  DELIVERABLE_TYPES,
  needsClosingWizard,
  opensClosingWizard,
  pendingDeliverables,
  prefillFor,
  type Deliverable,
  type TaskContext,
} from "./deliverables";

const LINE = "33333333-3333-4333-8333-333333333333";

function deliverable(
  type: Deliverable["deliverableType"],
  fulfilled = false,
): Deliverable {
  return {
    id: `id-${type}`,
    taskId: "44444444-4444-4444-8444-444444444444",
    deliverableType: type,
    fulfilledType: fulfilled ? "items" : null,
    fulfilledId: fulfilled ? "77777777-7777-4777-8777-777777777777" : null,
    fulfilledAt: fulfilled ? "2026-09-09T10:00:00Z" : null,
  };
}

function attachment(id: string) {
  return { id, fileName: `${id}.webp` };
}

const TASK: TaskContext = {
  title: "Set de 6 tazas artesanales",
  businessLineId: LINE,
  bodyMarkdown: "- [x] modelado\n- [ ] esmaltado",
  attachments: [attachment("a1"), attachment("a2")],
};

/**
 * KAM-21 · El dominio de entregables, su prellenado y la decisión de cierre.
 *
 * Escenarios del delta spec `task-links-deliverables`:
 * - requisito "Una tarea declara qué debe existir al terminarla" → «El ayudante
 *   no puede declarar un activo».
 * - requisito "El asistente ofrece un formulario prellenado por entregable" →
 *   «Dos entregables, dos formularios prellenados» (parte pura).
 * - requisito "Entrar en un estado final con entregables pendientes abre el
 *   asistente" → «Sin entregables se cierra directo», «La decisión se toma por
 *   el tipo del estado», «Retroceder no abre nada».
 * - requisito "Cerrar sin entregables deja una marca discreta y localizable" →
 *   «Sin entregables declarados no hay marca», «Crear alguno evita la marca».
 */
describe("dominio de entregables", () => {
  it("declara los seis tipos del esquema y ninguno más", () => {
    expect([...DELIVERABLE_TYPES]).toEqual([
      "product",
      "supply",
      "supplier",
      "purchase",
      "expenses",
      "asset",
    ]);
  });

  it("ofrece los seis a la persona dueña", () => {
    expect(declarableTypes(true)).toHaveLength(6);
  });

  // «El ayudante no puede declarar un activo»
  it("no ofrece el activo a un ayudante", () => {
    const types = declarableTypes(false).map((d) => d.type);

    expect(types).not.toContain("asset");
    expect(types).toHaveLength(5);
  });

  it("rechaza que un ayudante declare un activo, y admite el resto", () => {
    expect(canDeclare("asset", false)).toBe(false);
    expect(canDeclare("asset", true)).toBe(true);
    expect(canDeclare("product", false)).toBe(true);
  });
});

describe("prefillFor", () => {
  // «Dos entregables, dos formularios prellenados»
  it("lleva título, línea, notas y adjuntos de la tarea a cada tipo", () => {
    for (const type of DELIVERABLE_TYPES) {
      const prefill = prefillFor(type, TASK);

      expect(prefill.name).toBe(TASK.title);
      expect(prefill.notes).toBe(TASK.bodyMarkdown);
      expect(prefill.attachmentIds).toEqual(["a1", "a2"]);
    }
  });

  it("distingue el tipo de ítem de producto, insumo y activo", () => {
    expect(prefillFor("product", TASK).itemKind).toBe("product");
    expect(prefillFor("supply", TASK).itemKind).toBe("supply");
    expect(prefillFor("asset", TASK).itemKind).toBe("asset");
  });

  it("distingue la compra del gasto", () => {
    expect(prefillFor("purchase", TASK).expenseKind).toBe("purchase");
    expect(prefillFor("expenses", TASK).expenseKind).toBe("expense");
  });

  it("lleva la línea de la tarea a lo que pertenece a una línea", () => {
    expect(prefillFor("product", TASK).businessLineId).toBe(LINE);
    expect(prefillFor("purchase", TASK).businessLineId).toBe(LINE);
  });

  it("no le pone línea al proveedor, porque el directorio no la tiene", () => {
    expect(prefillFor("supplier", TASK).businessLineId).toBeNull();
    expect(prefillFor("supplier", TASK).contactRole).toBe("supplier");
  });

  it("acepta una tarea sin cuerpo y sin adjuntos", () => {
    const prefill = prefillFor("product", {
      ...TASK,
      bodyMarkdown: null,
      attachments: [],
    });

    expect(prefill.notes).toBeNull();
    expect(prefill.attachmentIds).toEqual([]);
  });
});

describe("needsClosingWizard", () => {
  // «Sin entregables se cierra directo»
  it("no abre el asistente si la tarea no declaró nada", () => {
    expect(needsClosingWizard("final", [])).toBe(false);
  });

  it("abre el asistente si queda un entregable sin cumplir", () => {
    expect(needsClosingWizard("final", [deliverable("product")])).toBe(true);
  });

  it("no abre el asistente si todos están cumplidos", () => {
    expect(needsClosingWizard("final", [deliverable("product", true)])).toBe(
      false,
    );
  });

  // «La decisión se toma por el tipo del estado»
  it("se decide por el tipo del estado y no por su nombre", () => {
    const pending = [deliverable("product")];

    expect(needsClosingWizard("final", pending)).toBe(true);
    expect(needsClosingWizard("in_progress", pending)).toBe(false);
    expect(needsClosingWizard("waiting", pending)).toBe(false);
  });

  /**
   * La variante que usa el tablero, que solo sabe cuántos quedan.
   *
   * Cubre *Entrar en un estado final con entregables pendientes abre el
   * asistente* → «Soltar en la columna final abre el asistente» y «Soltar en
   * la columna final sin entregables cierra sin preguntar» (delta `tasks`) en
   * su parte decidible sin navegador.
   */
  it("decide igual con un recuento que con la lista", () => {
    expect(opensClosingWizard("final", 1)).toBe(true);
    expect(opensClosingWizard("final", 0)).toBe(false);
    expect(opensClosingWizard("in_progress", 3)).toBe(false);
    expect(opensClosingWizard("initial", 3)).toBe(false);
  });

  // «Retroceder no abre nada»
  it("no abre nada al salir de un estado final", () => {
    expect(needsClosingWizard("initial", [deliverable("product")])).toBe(false);
    expect(needsClosingWizard("cancelled", [deliverable("product")])).toBe(
      false,
    );
  });
});

describe("closesWithoutDeliverables", () => {
  it("marca cuando había uno declarado y no se creó ninguno", () => {
    expect(closesWithoutDeliverables([deliverable("product")], 0)).toBe(true);
  });

  // «Sin entregables declarados no hay marca»
  it("no marca una tarea que nunca declaró nada", () => {
    expect(closesWithoutDeliverables([], 0)).toBe(false);
  });

  // «Crear alguno evita la marca»
  it("no marca si se creó al menos uno", () => {
    expect(
      closesWithoutDeliverables(
        [deliverable("product"), deliverable("expenses")],
        1,
      ),
    ).toBe(false);
  });

  it("no marca si todos estaban cumplidos de antes", () => {
    expect(closesWithoutDeliverables([deliverable("product", true)], 0)).toBe(
      false,
    );
  });
});

describe("pendingDeliverables", () => {
  it("deja fuera los cumplidos y conserva el orden", () => {
    const list = [
      deliverable("product", true),
      deliverable("supply"),
      deliverable("expenses"),
    ];

    expect(pendingDeliverables(list).map((d) => d.deliverableType)).toEqual([
      "supply",
      "expenses",
    ]);
  });
});
