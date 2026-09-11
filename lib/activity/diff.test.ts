import { describe, expect, it } from "vitest";

import { DETAIL_MARKERS, buildDetail, referencedIds } from "@/lib/activity/diff";
import { FIELDS, UNKNOWN_FIELD_LABEL } from "@/lib/activity/fields";

const STATUS_A = "aaaaaaaa-0000-0000-0000-000000000001";
const STATUS_B = "aaaaaaaa-0000-0000-0000-000000000002";
const USER = "bbbbbbbb-0000-0000-0000-000000000001";

const CONTEXT = {
  timezone: "America/La_Paz",
  currency: "Bs",
  names: new Map([
    [STATUS_A, "En diseño"],
    [STATUS_B, "En cola"],
    [USER, "Marcela"],
  ]),
};

const rows = (detail: ReturnType<typeof buildDetail>) =>
  detail.kind === "rows" ? detail.rows : [];

/**
 * KAM-22 · El antes y el después de un evento, legible.
 *
 * Escenarios de `activity-screen` § La fila expandida muestra el antes y el
 * después de los campos que cambiaron, y de `activity-log` § An event can be
 * rendered as a natural-language sentence (la mitad del detalle).
 */
describe("buildDetail", () => {
  // Escenario: Solo los campos que cambiaron
  it("una edición de un solo campo produce exactamente una fila", () => {
    const detail = buildDetail(
      "items",
      { sale_price: { antes: 45, despues: 50 } },
      CONTEXT,
    );

    expect(rows(detail)).toEqual([
      { label: "Precio de venta", before: "Bs 45.00", after: "Bs 50.00" },
    ]);
  });

  // Escenario: Una referencia se lee por su nombre
  it("un cambio de estado muestra los nombres, no los identificadores", () => {
    const detail = buildDetail(
      "orders",
      { status_id: { antes: STATUS_A, despues: STATUS_B } },
      CONTEXT,
    );

    expect(rows(detail)).toEqual([
      { label: "Estado", before: "En diseño", after: "En cola" },
    ]);
  });

  it("una persona se lee por su nombre", () => {
    const detail = buildDetail(
      "tasks",
      { assignee_id: { antes: null, despues: USER } },
      CONTEXT,
    );

    expect(rows(detail)[0]).toEqual({
      label: "Responsable",
      before: DETAIL_MARKERS.EMPTY,
      after: "Marcela",
    });
  });

  it("una referencia sin resolver no enseña el identificador", () => {
    const detail = buildDetail(
      "orders",
      { status_id: { antes: null, despues: "cccccccc-0000-0000-0000-000000000009" } },
      CONTEXT,
    );

    expect(rows(detail)[0].after).toBe(DETAIL_MARKERS.UNRESOLVED);
    expect(JSON.stringify(rows(detail))).not.toContain("cccccccc");
  });

  // Escenario: Ningún nombre de columna llega a la pantalla
  it("ningún rótulo coincide con el nombre de su columna", () => {
    for (const [table, columns] of Object.entries(FIELDS)) {
      for (const [column, spec] of Object.entries(columns)) {
        expect(spec.label, `${table}.${column}`).not.toBe(column);
        expect(spec.label).not.toMatch(/_/);
      }
    }
  });

  // Escenario (activity-log): The detail names its fields in the product's language
  it("un alta se lee campo a campo y descarta lo que nació vacío", () => {
    const detail = buildDetail(
      "contacts",
      {
        id: "no-se-muestra",
        organization_id: "tampoco",
        // El trigger las excluye del diff de una edición pero no de un alta,
        // donde copia la fila entera: sin descartarlas aquí, toda creación
        // mostraba dos filas de «Otro dato» con una marca de tiempo.
        created_at: "2026-08-19T15:24:08.801433+00:00",
        updated_at: "2026-08-19T15:24:08.801433+00:00",
        name: "Insumos del Sur",
        phone: "712 44 890",
        email: null,
        is_supplier: true,
        is_customer: false,
        notes: null,
        archived_at: null,
      },
      CONTEXT,
    );

    expect(rows(detail)).toEqual([
      { label: "Nombre", before: "—", after: "Insumos del Sur" },
      { label: "Teléfono", before: "—", after: "712 44 890" },
      { label: "Es proveedor", before: "—", after: "Sí" },
    ]);
  });

  // Escenario (activity-log): An unknown field still renders
  it("un campo que el diccionario no conoce se rinde sin filtrar su columna", () => {
    const detail = buildDetail(
      "orders",
      { campo_de_una_tarea_futura: { antes: "a", despues: "b" } },
      CONTEXT,
    );

    expect(rows(detail)).toEqual([
      { label: UNKNOWN_FIELD_LABEL, before: "a", after: "b" },
    ]);
    expect(rows(detail)[0].label).not.toContain("campo_de_una_tarea_futura");
  });

  it("los campos ocultos no se rinden aunque cambien", () => {
    const detail = buildDetail(
      "invitations",
      {
        token_hash: { antes: "\\x00", despues: "\\xff" },
        role: { antes: "assistant", despues: "owner" },
      },
      CONTEXT,
    );

    expect(rows(detail)).toEqual([
      { label: "Rol ofrecido", before: "Ayudante", after: "Dueño" },
    ]);
  });

  it("un valor de conjunto cerrado se lee en español", () => {
    const detail = buildDetail(
      "payments",
      { direction: { antes: "out", despues: "in" } },
      CONTEXT,
    );

    expect(rows(detail)[0]).toMatchObject({ before: "Pago", after: "Cobro" });
  });

  it("una fecha se presenta en la zona de la organización", () => {
    const detail = buildDetail(
      "tasks",
      { due_at: { antes: null, despues: "2026-08-20T03:00:00.000Z" } },
      CONTEXT,
    );

    // 03:00 UTC del día 20 es el 19 a las 23:00 en La Paz.
    expect(rows(detail)[0].after).toContain("19");
  });

  it("un texto largo se recorta en vez de desbordar la celda", () => {
    const long = "x".repeat(500);
    const detail = buildDetail(
      "tasks",
      { body_markdown: { antes: null, despues: long } },
      CONTEXT,
    );

    expect(rows(detail)[0].after.length).toBeLessThan(200);
    expect(rows(detail)[0].after.endsWith("…")).toBe(true);
  });

  // Escenario: Un detalle purgado se explica
  // Escenario (activity-log): An emptied payload states its absence
  it("un detalle vaciado por la retención se declara, no se rinde vacío", () => {
    expect(buildDetail("orders", null, CONTEXT)).toEqual({ kind: "purged" });
  });
});

describe("referencedIds", () => {
  it("reúne los identificadores que hay que resolver, de ambos lados", () => {
    const ids = referencedIds(
      "orders",
      {
        status_id: { antes: STATUS_A, despues: STATUS_B },
        created_by: USER,
        notes: { antes: "a", despues: "b" },
      },
    );

    expect(ids.sort()).toEqual([STATUS_A, STATUS_B, USER].sort());
  });

  it("un detalle purgado no pide resolver nada", () => {
    expect(referencedIds("orders", null)).toEqual([]);
  });
});
