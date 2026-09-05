import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { GEEKO, lineTotals, sellDirect, signIn } from "./fair-support";

/**
 * KAM-12 · Los ingresos suman pedidos y ventas directas.
 *
 * Escenarios del delta spec `orders` — requisito "Las consultas de ingresos
 * incluyen las ventas directas": «Ingresos de la línea», «Una sola fuente»,
 * «El cobrado también suma», «La venta directa archivada no suma».
 *
 * Contra la base real y como usuario autenticado: lo que se comprueba es que
 * `order_totals` sea de verdad una fuente única, y eso no se puede verificar
 * ni con un cliente simulado ni saltándose RLS.
 */

let db: SupabaseClient;

beforeAll(async () => {
  db = await signIn();
});

describe("los ingresos incluyen las ventas directas", () => {
  // Escenario: Ingresos de la línea · El cobrado también suma
  it("una venta directa suma al ingreso de su línea igual que un pedido", async () => {
    const antes = await lineTotals(db, GEEKO.alfareria);

    await sellDirect(db, {
      businessLineId: GEEKO.alfareria,
      itemId: GEEKO.tazaDeBarro,
      quantity: 2,
      unitPrice: 35,
      amount: 70,
    });

    const despues = await lineTotals(db, GEEKO.alfareria);

    expect(despues.total - antes.total).toBe(70);
    expect(despues.paid - antes.paid).toBe(70);
  });

  it("una venta cobrada en parte suma su total entero y solo lo cobrado", async () => {
    const antes = await lineTotals(db, GEEKO.alfareria);

    await sellDirect(db, {
      businessLineId: GEEKO.alfareria,
      itemId: GEEKO.tazaDeBarro,
      quantity: 1,
      unitPrice: 100,
      amount: 40,
    });

    const despues = await lineTotals(db, GEEKO.alfareria);

    expect(despues.total - antes.total).toBe(100);
    expect(despues.paid - antes.paid).toBe(40);
    // El saldo pendiente se deriva, no se almacena.
    expect(despues.total - despues.paid - (antes.total - antes.paid)).toBe(60);
  });

  // Escenario: Una sola fuente
  it("pedidos y ventas directas conviven en order_totals, sin otra tabla que unir", async () => {
    const { data, error } = await db
      .from("order_totals")
      .select("kind")
      .eq("business_line_id", GEEKO.alfareria);

    expect(error).toBeNull();
    expect(new Set((data ?? []).map((row) => row.kind))).toEqual(
      new Set(["order", "direct_sale"]),
    );
  });

  it("el ingreso de la línea es la suma de las dos clases, sin distinguirlas", async () => {
    const { data } = await db
      .from("order_totals")
      .select("kind, total")
      .eq("business_line_id", GEEKO.alfareria);

    const filas = data ?? [];
    const suma = (kind: string) =>
      filas.filter((r) => r.kind === kind).reduce((s, r) => s + Number(r.total), 0);
    const todo = filas.reduce((s, r) => s + Number(r.total), 0);

    expect(suma("order") + suma("direct_sale")).toBe(todo);
    expect(suma("direct_sale")).toBeGreaterThan(0);
  });

  // Escenario: La venta directa archivada no suma
  it("archivada la venta, su ingreso deja de sumar", async () => {
    const saleId = await sellDirect(db, {
      businessLineId: GEEKO.alfareria,
      itemId: GEEKO.tazaDeBarro,
      quantity: 1,
      unitPrice: 55,
      amount: 55,
    });

    const conVenta = await lineTotals(db, GEEKO.alfareria);

    const { error } = await db
      .from("orders")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", saleId);
    expect(error).toBeNull();

    const archivada = await lineTotals(db, GEEKO.alfareria);

    expect(conVenta.total - archivada.total).toBe(55);

    const { data } = await db.from("order_totals").select("order_id").eq("order_id", saleId);
    expect(data ?? []).toHaveLength(0);
  });
});
