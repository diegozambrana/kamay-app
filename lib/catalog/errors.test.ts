import { describe, expect, it } from "vitest";

import { catalogErrorMessage } from "./errors";

const FALLBACK = "No se pudo guardar.";

describe("catalogErrorMessage", () => {
  it("traduce el rechazo del trigger de archivado", () => {
    expect(
      catalogErrorMessage(
        new Error("Solo la persona dueña puede archivar o desarchivar"),
        FALLBACK,
      ),
    ).toBe("Solo la persona dueña puede archivar o desarchivar.");
  });

  it("traduce el intento de editar un archivado", () => {
    expect(
      catalogErrorMessage(
        new Error(
          "Un registro archivado no se puede editar: desarchívalo primero",
        ),
        FALLBACK,
      ),
    ).toContain("desarchívalo antes de editarlo");
  });

  it("traduce la restricción de rol del contacto", () => {
    expect(
      catalogErrorMessage(
        new Error('new row violates check constraint "has_a_role"'),
        FALLBACK,
      ),
    ).toBe("Un contacto tiene que ser proveedor, cliente o ambos.");
  });

  it("traduce la variante duplicada antes que la unicidad genérica", () => {
    expect(
      catalogErrorMessage(
        new Error(
          'duplicate key value violates unique constraint "item_variants_item_id_name_key"',
        ),
        FALLBACK,
      ),
    ).toBe("Ese ítem ya tiene una variante con ese nombre.");
  });

  it("lo que no reconoce queda en el mensaje de respaldo", () => {
    expect(catalogErrorMessage(new Error("timeout"), FALLBACK)).toBe(
      "No se pudo guardar. Intenta de nuevo.",
    );
    expect(catalogErrorMessage("ni siquiera es un Error", FALLBACK)).toBe(
      "No se pudo guardar. Intenta de nuevo.",
    );
  });
});
