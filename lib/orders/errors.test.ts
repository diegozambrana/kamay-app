import { describe, expect, it } from "vitest";

import { orderErrorMessage } from "@/lib/orders/errors";

describe("orderErrorMessage", () => {
  it("traduce el rechazo del trigger de archivado", () => {
    expect(
      orderErrorMessage(
        new Error("Solo la persona dueña puede archivar o desarchivar"),
        "No se pudo archivar.",
      ),
    ).toBe("Solo la persona dueña puede archivar o desarchivar.");
  });

  it("traduce el intento de editar un archivado", () => {
    expect(
      orderErrorMessage(
        new Error("Un registro archivado no se puede editar: desarchívalo primero"),
        "No se pudo mover.",
      ),
    ).toBe("Este pedido está archivado: desarchívalo antes de editarlo.");
  });

  it("traduce la restricción de cliente obligatorio", () => {
    expect(
      orderErrorMessage(
        new Error('violates check constraint "order_needs_customer"'),
        "No se pudo guardar.",
      ),
    ).toBe("Un pedido necesita un cliente.");
  });

  it("cae al mensaje de reserva ante un error desconocido", () => {
    expect(orderErrorMessage(new Error("boom"), "No se pudo mover el pedido.")).toBe(
      "No se pudo mover el pedido. Intenta de nuevo.",
    );
  });

  it("tolera un error que no es Error", () => {
    expect(orderErrorMessage("texto suelto", "No se pudo.")).toBe(
      "No se pudo. Intenta de nuevo.",
    );
  });
});
