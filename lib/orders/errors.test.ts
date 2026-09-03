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

describe("orderErrorMessage · alta y edición (KAM-08)", () => {
  it("traduce el rechazo del pedido sin líneas", () => {
    expect(
      orderErrorMessage(
        new Error("Un pedido necesita al menos una línea"),
        "No se pudo guardar el pedido.",
      ),
    ).toBe("Un pedido necesita al menos una línea.");
  });

  it("traduce la comprobación de organización de create_order", () => {
    expect(
      orderErrorMessage(
        new Error("No perteneces a esa organización"),
        "No se pudo guardar el pedido.",
      ),
    ).toBe("Ese pedido no pertenece a tu organización.");
  });

  it("traduce el pedido que ya no está a la vista", () => {
    expect(
      orderErrorMessage(
        new Error("Ese pedido ya no está a tu alcance"),
        "No se pudo guardar.",
      ),
    ).toBe("Ese pedido ya no está a tu alcance.");
  });

  it("traduce la línea sin estado inicial configurado", () => {
    expect(
      orderErrorMessage(
        new Error("La línea no tiene un estado inicial configurado"),
        "No se pudo guardar.",
      ),
    ).toBe(
      "Esa línea no tiene un estado inicial configurado. Revísalo en Configuración.",
    );
  });

  it("traduce los checks de cantidad y precio de una línea", () => {
    expect(
      orderErrorMessage(
        new Error('violates check constraint "order_items_quantity_check"'),
        "No se pudo guardar.",
      ),
    ).toBe("La cantidad de una línea tiene que ser mayor que cero.");
    expect(
      orderErrorMessage(
        new Error('violates check constraint "order_items_unit_price_check"'),
        "No se pudo guardar.",
      ),
    ).toBe("El precio de una línea no puede ser negativo.");
  });

  it("sigue traduciendo el archivado, que ahora también rechaza la edición", () => {
    expect(
      orderErrorMessage(
        new Error("Un registro archivado no se puede editar: desarchívalo primero"),
        "No se pudo guardar el pedido.",
      ),
    ).toBe("Este pedido está archivado: desarchívalo antes de editarlo.");
  });
});
