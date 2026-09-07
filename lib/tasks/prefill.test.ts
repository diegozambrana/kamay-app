import { describe, expect, it } from "vitest";

import { prefillFromOrder, type OrderContext } from "./prefill";

const ORDER: OrderContext = {
  id: "55555555-5555-4555-8555-555555555555",
  code: 142,
  businessLineId: "33333333-3333-4333-8333-333333333333",
  dueDate: "2026-09-20",
  customerName: "Ana Quispe",
};

/**
 * KAM-15 · El prellenado desde el pedido.
 *
 * Escenarios del delta spec `tasks` — requisito "Crear tarea para este pedido
 * con formulario prellenado": «Formulario prellenado» y «Pedido sin fecha
 * comprometida».
 */
describe("prefillFromOrder", () => {
  it("trae la línea del pedido", () => {
    expect(prefillFromOrder(ORDER, "2026-09-07").businessLineId).toBe(
      ORDER.businessLineId,
    );
  });

  it("trae el vínculo al pedido", () => {
    expect(prefillFromOrder(ORDER, "2026-09-07").link).toEqual({
      entityType: "order",
      entityId: ORDER.id,
    });
  });

  it("nombra el pedido en el título, para que la tarjeta se entienda sola", () => {
    expect(prefillFromOrder(ORDER, "2026-09-07").title).toBe(
      "Diseñar arte pedido #142",
    );
  });

  it("trae una fecha anterior a la de entrega", () => {
    const prefill = prefillFromOrder(ORDER, "2026-09-07");
    expect(prefill.dueDate! < ORDER.dueDate!).toBe(true);
  });

  it("trae el cliente como contexto, no como dato de la tarea", () => {
    const prefill = prefillFromOrder(ORDER, "2026-09-07");
    expect(prefill.customerName).toBe("Ana Quispe");
    // El vínculo refleja el pedido; el cliente no se copia dentro de la tarea.
    expect(Object.keys(prefill)).not.toContain("contactId");
  });

  it("sin fecha comprometida, llega sin fecha sugerida", () => {
    const prefill = prefillFromOrder({ ...ORDER, dueDate: null }, "2026-09-07");
    expect(prefill.dueDate).toBeNull();
  });

  it("un pedido sin cliente no rompe el prellenado", () => {
    const prefill = prefillFromOrder({ ...ORDER, customerName: null }, "2026-09-07");
    expect(prefill.customerName).toBeNull();
    expect(prefill.businessLineId).toBe(ORDER.businessLineId);
  });
});
