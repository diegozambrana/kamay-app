import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { OrderService } from "@/services/orders/order-service";

import { GEEKO, sellDirect, signIn } from "./fair-support";

/**
 * KAM-12 · El tablero es de pedidos.
 *
 * Escenarios del delta spec `orders` — requisito modificado "Vistas
 * alternativas y filtros del tablero": «La venta directa no aparece en el
 * tablero», «La venta directa tampoco aparece en lista ni calendario», «Ver
 * archivados no la trae de vuelta».
 *
 * Se ejercita el **servicio real contra la base real**: la exclusión vive en
 * una sola consulta y las tres vistas de V3 comen de ella, así que probar el
 * servicio prueba las tres. Lo que esto añade sobre la prueba unitaria es que
 * comprueba el resultado, no la forma de la consulta.
 */

let db: SupabaseClient;
let orders: OrderService;
let saleId: string;

beforeAll(async () => {
  db = await signIn();
  orders = new OrderService(db);

  // Sublimación y no Alfarería: esa línea es de `direct-sale-revenue`, que
  // mide deltas de ingreso y no puede compartirla (ver `fair-support`).
  saleId = await sellDirect(db, {
    businessLineId: GEEKO.sublimacion,
    itemId: GEEKO.tazaPersonalizada,
    quantity: 1,
    unitPrice: 35,
    amount: 35,
  });
});

describe("el tablero excluye las ventas directas", () => {
  // Escenario: La venta directa no aparece en el tablero
  it("la venta recién registrada no aparece entre los pedidos", async () => {
    const lista = await orders.list(GEEKO.organizationId);

    expect(lista.map((order) => order.id)).not.toContain(saleId);
  });

  it("ninguna fila devuelta es una venta directa", async () => {
    const lista = await orders.list(GEEKO.organizationId);

    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((order) => order.kind === "order")).toBe(true);
  });

  // Escenario: La venta directa tampoco aparece en lista ni calendario
  // Las tres vistas de V3 comen del mismo conjunto: filtrar por línea —lo que
  // hacen lista y calendario— no puede reintroducirla.
  it("filtrando por su propia línea tampoco aparece", async () => {
    const lista = await orders.list(GEEKO.organizationId, {
      businessLineId: GEEKO.sublimacion,
    });

    expect(lista.map((order) => order.id)).not.toContain(saleId);
    expect(lista.every((order) => order.kind === "order")).toBe(true);
  });

  // Escenario: Ver archivados no la trae de vuelta
  it("«Ver archivados» no la trae de vuelta estando vigente", async () => {
    const lista = await orders.list(GEEKO.organizationId, { includeArchived: true });

    expect(lista.map((order) => order.id)).not.toContain(saleId);
  });

  it("«Ver archivados» tampoco la trae estando archivada", async () => {
    await db
      .from("orders")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", saleId);

    const lista = await orders.list(GEEKO.organizationId, { includeArchived: true });

    expect(lista.map((order) => order.id)).not.toContain(saleId);
    expect(lista.every((order) => order.kind === "order")).toBe(true);
  });

  // La otra mitad: la venta existe, simplemente no es asunto del tablero.
  it("la venta existe y es legible por su propia vía", async () => {
    const { data } = await db.from("orders").select("id, kind").eq("id", saleId).single();

    expect(data).toMatchObject({ id: saleId, kind: "direct_sale" });
  });
});
