import { describe, expect, it } from "vitest";

import {
  contactFormSchema,
  hasARole,
  itemFormSchema,
  quickContactSchema,
} from "./schema";

const validItem = {
  name: "Taza para sublimación",
  kind: "supply" as const,
  businessLineId: null,
  unitId: null,
};

const validContact = {
  name: "Distribuidora Andina",
  isSupplier: true,
  isCustomer: false,
};

describe("itemFormSchema", () => {
  it("un ítem sin línea es válido: es compartido, no está incompleto", () => {
    const parsed = itemFormSchema.safeParse(validItem);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.businessLineId).toBeNull();
  });

  it("rechaza un tipo fuera del juego permitido", () => {
    expect(
      itemFormSchema.safeParse({ ...validItem, kind: "machine" }).success,
    ).toBe(false);
  });

  it("rechaza el nombre vacío", () => {
    expect(itemFormSchema.safeParse({ ...validItem, name: "   " }).success).toBe(
      false,
    );
  });

  it("un precio vacío es ausencia de dato, no cero", () => {
    const parsed = itemFormSchema.safeParse({ ...validItem, salePrice: "" });
    expect(parsed.data?.salePrice).toBeNull();
  });

  it("rechaza un precio negativo", () => {
    expect(
      itemFormSchema.safeParse({ ...validItem, salePrice: "-3" }).success,
    ).toBe(false);
  });
});

describe("contactFormSchema", () => {
  it("acepta un contacto que es proveedor y cliente a la vez", () => {
    expect(
      contactFormSchema.safeParse({
        ...validContact,
        isCustomer: true,
      }).success,
    ).toBe(true);
  });

  it("rechaza un contacto sin ningún rol", () => {
    const parsed = contactFormSchema.safeParse({
      ...validContact,
      isSupplier: false,
      isCustomer: false,
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toContain("proveedor, cliente o ambos");
  });

  it("rechaza un correo mal formado y acepta que falte", () => {
    expect(
      contactFormSchema.safeParse({ ...validContact, email: "no-es-correo" })
        .success,
    ).toBe(false);
    expect(
      contactFormSchema.safeParse({ ...validContact, email: "" }).data?.email,
    ).toBeNull();
  });
});

describe("quickContactSchema", () => {
  it("la creación al vuelo exige identificador, nombre y al menos un rol", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    expect(
      quickContactSchema.safeParse({ id, ...validContact }).success,
    ).toBe(true);
    expect(
      quickContactSchema.safeParse({
        id,
        name: "Sin rol",
        isSupplier: false,
        isCustomer: false,
      }).success,
    ).toBe(false);
  });
});

describe("hasARole", () => {
  it("es la misma regla que la base garantiza después", () => {
    expect(hasARole({ isSupplier: false, isCustomer: false })).toBe(false);
    expect(hasARole({ isSupplier: true, isCustomer: false })).toBe(true);
    expect(hasARole({ isSupplier: false, isCustomer: true })).toBe(true);
  });
});

describe("quickContactSchema · teléfono (KAM-08)", () => {
  const quick = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Marisol Quispe",
    isSupplier: false,
    isCustomer: true,
  };

  it("guarda el teléfono cuando llega", () => {
    const parsed = quickContactSchema.safeParse({ ...quick, phone: "77712345" });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.phone).toBe("77712345");
  });

  it("un teléfono ausente o vacío es ausencia de dato, no cadena vacía", () => {
    expect(quickContactSchema.safeParse(quick).data?.phone).toBeNull();
    expect(
      quickContactSchema.safeParse({ ...quick, phone: "" }).data?.phone,
    ).toBeNull();
    expect(
      quickContactSchema.safeParse({ ...quick, phone: "   " }).data?.phone,
    ).toBeNull();
  });

  it("sigue exigiendo nombre y al menos un rol", () => {
    expect(
      quickContactSchema.safeParse({ ...quick, name: "", phone: "777" }).success,
    ).toBe(false);
    expect(
      quickContactSchema.safeParse({
        ...quick,
        isCustomer: false,
        phone: "777",
      }).success,
    ).toBe(false);
  });
});
