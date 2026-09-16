import { describe, expect, it } from "vitest";

import type { Contact, Item } from "@/types";

import { type CatalogScope, joinsCatalogWindow, joinsContactWindow } from "./window";

const LINE = "30000000-0000-0000-0000-000000000001";

const ITEM: Item = {
  id: "40000000-0000-0000-0000-000000000001",
  organizationId: "10000000-0000-0000-0000-000000000003",
  businessLineId: LINE,
  kind: "product",
  name: "Zapatos de sublimación",
  description: null,
  unitId: null,
  categoryId: null,
  salePrice: 45,
  minStock: null,
  archivedAt: null,
};

const SCOPE: CatalogScope = {
  kind: "product",
  lineFilter: "all",
  categoryFilter: "all",
  search: "",
  includeArchived: false,
};

describe("joinsCatalogWindow", () => {
  it("un ítem de la pestaña y sin filtros que lo excluyan entra", () => {
    expect(joinsCatalogWindow(ITEM, SCOPE)).toBe(true);
    expect(joinsCatalogWindow(ITEM, { ...SCOPE, lineFilter: LINE })).toBe(true);
  });

  it("uno de otra pestaña no se cuela", () => {
    expect(joinsCatalogWindow(ITEM, { ...SCOPE, kind: "supply" })).toBe(false);
  });

  it("respeta el filtro de línea y el de compartidos", () => {
    expect(
      joinsCatalogWindow(ITEM, { ...SCOPE, lineFilter: "30000000-0000-0000-0000-000000000002" }),
    ).toBe(false);
    expect(joinsCatalogWindow(ITEM, { ...SCOPE, lineFilter: "shared" })).toBe(false);
    expect(
      joinsCatalogWindow({ ...ITEM, businessLineId: null }, { ...SCOPE, lineFilter: "shared" }),
    ).toBe(true);
  });

  it("respeta la búsqueda, con la misma normalización que la base", () => {
    expect(joinsCatalogWindow(ITEM, { ...SCOPE, search: "SUBLIMACION" })).toBe(true);
    expect(joinsCatalogWindow(ITEM, { ...SCOPE, search: "taza" })).toBe(false);
  });

  it("respeta el filtro de categoría y el de «sin categoría»", () => {
    const VAJILLA = "92000000-0000-0000-0000-000000000013";
    const conCategoria = { ...ITEM, categoryId: VAJILLA };

    expect(joinsCatalogWindow(conCategoria, { ...SCOPE, categoryFilter: VAJILLA })).toBe(true);
    expect(
      joinsCatalogWindow(conCategoria, {
        ...SCOPE,
        categoryFilter: "92000000-0000-0000-0000-000000000011",
      }),
    ).toBe(false);
    expect(joinsCatalogWindow(conCategoria, { ...SCOPE, categoryFilter: "none" })).toBe(false);
    expect(joinsCatalogWindow(ITEM, { ...SCOPE, categoryFilter: "none" })).toBe(true);
    expect(joinsCatalogWindow(ITEM, { ...SCOPE, categoryFilter: VAJILLA })).toBe(false);
  });

  it("un archivado solo entra si se piden los archivados", () => {
    const archived = { ...ITEM, archivedAt: "2026-09-11T00:00:00Z" };
    expect(joinsCatalogWindow(archived, SCOPE)).toBe(false);
    expect(joinsCatalogWindow(archived, { ...SCOPE, includeArchived: true })).toBe(true);
  });
});

const CONTACT: Contact = {
  id: "80000000-0000-0000-0000-000000000001",
  organizationId: "10000000-0000-0000-0000-000000000003",
  name: "Proveedora Ñandú",
  phone: null,
  email: null,
  address: null,
  isSupplier: true,
  isCustomer: false,
  notes: null,
  archivedAt: null,
};

describe("joinsContactWindow", () => {
  const all = { role: "all" as const, search: "", includeArchived: false };

  it("un contacto vigente y sin filtros que lo excluyan entra", () => {
    expect(joinsContactWindow(CONTACT, all)).toBe(true);
    expect(joinsContactWindow(CONTACT, { ...all, role: "supplier" })).toBe(true);
  });

  it("un archivado sale de la lista, salvo que se pidan los archivados", () => {
    const archived = { ...CONTACT, archivedAt: "2026-09-11T00:00:00Z" };
    expect(joinsContactWindow(archived, all)).toBe(false);
    expect(joinsContactWindow(archived, { ...all, includeArchived: true })).toBe(true);
  });

  it("respeta el rol y la búsqueda", () => {
    expect(joinsContactWindow(CONTACT, { ...all, role: "customer" })).toBe(false);
    expect(joinsContactWindow(CONTACT, { ...all, search: "nandu" })).toBe(true);
    expect(joinsContactWindow(CONTACT, { ...all, search: "taller" })).toBe(false);
  });
});
