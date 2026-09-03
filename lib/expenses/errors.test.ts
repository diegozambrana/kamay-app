import { describe, expect, it } from "vitest";

import { expenseErrorMessage } from "./errors";

describe("expenseErrorMessage", () => {
  it("traduce las restricciones de la base a mensajes comprensibles", () => {
    expect(
      expenseErrorMessage(
        new Error('new row violates check constraint "purchase_needs_supplier"'),
        "x",
      ),
    ).toBe("Una compra necesita un proveedor.");
    expect(
      expenseErrorMessage(
        new Error('violates check constraint "expense_needs_category_and_amount"'),
        "x",
      ),
    ).toBe("Un gasto necesita monto y categoría.");
    expect(
      expenseErrorMessage(new Error("Una compra necesita al menos una línea"), "x"),
    ).toBe("Una compra necesita al menos un insumo.");
  });

  it("traduce el rechazo del trigger de archivado", () => {
    expect(
      expenseErrorMessage(
        new Error("Solo la persona dueña puede archivar o desarchivar"),
        "x",
      ),
    ).toBe("Solo la persona dueña puede archivar o desarchivar.");
    expect(
      expenseErrorMessage(
        new Error("Un registro archivado no se puede editar: desarchívalo primero"),
        "x",
      ),
    ).toBe("Este egreso está archivado: desarchívalo antes de tocarlo.");
  });

  it("traduce el rechazo de la función de alta al ayudante", () => {
    expect(
      expenseErrorMessage(new Error("Solo la persona dueña registra egresos"), "x"),
    ).toBe("Solo la persona dueña registra egresos.");
  });

  it("traduce un rechazo de RLS sin exponer jerga", () => {
    expect(
      expenseErrorMessage(
        new Error('new row violates row-level security policy for table "expenses"'),
        "x",
      ),
    ).toBe("No tienes permiso para hacer eso.");
  });

  it("cae al mensaje de reserva con cualquier otra cosa", () => {
    expect(expenseErrorMessage(new Error("boom"), "No se pudo guardar.")).toBe(
      "No se pudo guardar. Intenta de nuevo.",
    );
    expect(expenseErrorMessage("no es un Error", "No se pudo guardar.")).toBe(
      "No se pudo guardar. Intenta de nuevo.",
    );
  });
});
