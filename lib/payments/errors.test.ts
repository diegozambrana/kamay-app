import { describe, expect, it } from "vitest";

import { paymentErrorMessage } from "./errors";

const FALLBACK = "No se pudo registrar el cobro.";

describe("paymentErrorMessage", () => {
  it("traduce el rechazo de la inmutabilidad a la vía prevista", () => {
    expect(
      paymentErrorMessage(
        new Error("Un movimiento de dinero no se edita: anúlalo y registra otro"),
        FALLBACK,
      ),
    ).toBe("Un movimiento de dinero no se edita: anúlalo y registra otro.");
  });

  it("traduce el rechazo del trigger de archivado", () => {
    expect(
      paymentErrorMessage(
        new Error("Solo la persona dueña puede archivar o desarchivar"),
        FALLBACK,
      ),
    ).toBe("Solo la persona dueña puede anular un movimiento.");
  });

  it("explica un movimiento ya anulado", () => {
    expect(
      paymentErrorMessage(
        new Error("Un registro archivado no se puede editar: desarchívalo primero"),
        FALLBACK,
      ),
    ).toBe("Este movimiento ya está anulado.");
  });

  it("traduce las dos restricciones del destino", () => {
    expect(
      paymentErrorMessage(new Error('violates check constraint "exactly_one_target"'), FALLBACK),
    ).toBe("Un movimiento apunta a un pedido o a un egreso, nunca a los dos.");
    expect(
      paymentErrorMessage(
        new Error('violates check constraint "direction_matches_target"'),
        FALLBACK,
      ),
    ).toBe("Un cobro va contra un pedido y un pago contra un egreso.");
  });

  it("traduce el monto y el método", () => {
    expect(
      paymentErrorMessage(new Error('violates check constraint "payments_amount_check"'), FALLBACK),
    ).toBe("El monto tiene que ser mayor que cero.");
    expect(
      paymentErrorMessage(new Error('violates check constraint "payments_method_check"'), FALLBACK),
    ).toBe("Elige una forma de pago válida.");
  });

  it("traduce el destino de otra organización", () => {
    expect(
      paymentErrorMessage(
        new Error('violates foreign key constraint "payments_order_same_organization"'),
        FALLBACK,
      ),
    ).toBe("Ese documento no es de esta organización.");
  });

  it("no filtra el detalle de una violación de RLS", () => {
    expect(
      paymentErrorMessage(
        new Error('new row violates row-level security policy for table "payments"'),
        FALLBACK,
      ),
    ).toBe("No tienes permiso para hacer eso.");
  });

  it("cae en el mensaje de reserva ante un error desconocido", () => {
    expect(paymentErrorMessage(new Error("boom"), FALLBACK)).toBe(
      "No se pudo registrar el cobro. Intenta de nuevo.",
    );
    expect(paymentErrorMessage("ni siquiera un Error", FALLBACK)).toBe(
      "No se pudo registrar el cobro. Intenta de nuevo.",
    );
  });
});
