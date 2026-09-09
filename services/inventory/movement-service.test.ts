import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { MovementService } from "./movement-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const ITEM = "33333333-3333-3333-3333-333333333333";
const MOVEMENT = "44444444-4444-4444-4444-444444444444";

const consumption = {
  id: MOVEMENT,
  itemId: ITEM,
  variantId: null,
  quantity: 5,
  occurredAt: "2026-09-08T10:00:00.000Z",
  note: "Pedido #1",
};

describe("MovementService.registerConsumption", () => {
  it("guarda una salida con la cantidad en negativo", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new MovementService(client.asSupabase()).registerConsumption(ORG, consumption);

    expect(client.tables[0]).toBe("inventory_movements");
    const [payload] = client.queries[0].argsOf("insert") as [Record<string, unknown>];
    expect(payload.kind).toBe("out");
    // El formulario pide «consumí 5»; el signo lo pone el servicio, porque es
    // la base la que exige que una salida sea negativa.
    expect(payload.quantity).toBe(-5);
    expect(payload.organization_id).toBe(ORG);
  });

  // Design D5: el origen `order_item` limitaría a un movimiento por línea de
  // pedido. Todo consumo humano nace `manual`, venga de donde venga.
  it("marca el consumo como manual y deja la referencia en la nota", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new MovementService(client.asSupabase()).registerConsumption(ORG, consumption);

    const [payload] = client.queries[0].argsOf("insert") as [Record<string, unknown>];
    expect(payload.source_type).toBe("manual");
    expect(payload.note).toBe("Pedido #1");
  });

  it("conserva el identificador del dispositivo y su hora del hecho", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new MovementService(client.asSupabase()).registerConsumption(ORG, consumption);

    const [payload] = client.queries[0].argsOf("insert") as [Record<string, unknown>];
    expect(payload.id).toBe(MOVEMENT);
    expect(payload.occurred_at).toBe("2026-09-08T10:00:00.000Z");
  });

  it("una cantidad ya negativa no vuelve a invertirse", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new MovementService(client.asSupabase()).registerConsumption(ORG, {
      ...consumption,
      quantity: -5,
    });

    const [payload] = client.queries[0].argsOf("insert") as [Record<string, unknown>];
    expect(payload.quantity).toBe(-5);
  });

  it("sube el error de la base para que la acción lo traduzca", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(
      new MovementService(client.asSupabase()).registerConsumption(ORG, consumption),
    ).rejects.toMatchObject({ message: "boom" });
  });
});

describe("MovementService.registerCountAdjustment", () => {
  const count = {
    id: MOVEMENT,
    itemId: ITEM,
    variantId: null,
    difference: -5,
    occurredAt: "2026-09-08T10:00:00.000Z",
    note: null,
  };

  // Design D6: la diferencia llega calculada por el diálogo y se guarda tal
  // cual. Recalcularla aquí borraría lo ocurrido entre el conteo y su envío.
  it("guarda la diferencia tal como llega, sin recalcular nada", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new MovementService(client.asSupabase()).registerCountAdjustment(ORG, count);

    const [payload] = client.queries[0].argsOf("insert") as [Record<string, unknown>];
    expect(payload.kind).toBe("adjustment");
    expect(payload.quantity).toBe(-5);
    expect(payload.source_type).toBe("count");
  });

  it("conserva el signo de un conteo por encima del saldo", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    await new MovementService(client.asSupabase()).registerCountAdjustment(ORG, {
      ...count,
      difference: 12,
    });

    const [payload] = client.queries[0].argsOf("insert") as [Record<string, unknown>];
    expect(payload.quantity).toBe(12);
  });

  it("sube el error de la base", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(
      new MovementService(client.asSupabase()).registerCountAdjustment(ORG, count),
    ).rejects.toMatchObject({ message: "boom" });
  });
});

describe("MovementService.balances", () => {
  const row = {
    item_id: ITEM,
    organization_id: ORG,
    balance: "57.000",
    min_stock: "12.000",
    below_min: false,
  };

  it("filtra por organización explícitamente aunque RLS ya lo haga", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    await new MovementService(client.asSupabase()).balances(ORG);

    const query = client.queries[0];
    expect(client.tables[0]).toBe("item_balances");
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
  });

  // `numeric` llega como texto desde PostgREST: no se pierde precisión.
  it("convierte el numérico de texto a número", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    const [balance] = await new MovementService(client.asSupabase()).balances(ORG);

    expect(balance.balance).toBe(57);
    expect(balance.minStock).toBe(12);
    expect(balance.belowMin).toBe(false);
  });

  it("un insumo sin mínimo declarado llega con mínimo nulo", async () => {
    const client = new FakeClient([
      { data: [{ ...row, min_stock: null }], error: null },
    ]);
    const [balance] = await new MovementService(client.asSupabase()).balances(ORG);

    expect(balance.minStock).toBeNull();
  });

  it("recorta a lo que está bajo mínimo cuando se pide", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new MovementService(client.asSupabase()).balances(ORG, { belowMinOnly: true });

    expect(client.queries[0].has("eq", "below_min", true)).toBe(true);
  });

  // El recorte por línea no vive aquí: `item_balances` es una vista agregada
  // y PostgREST no sabe unirla con `items`. Lo hace `scopedToLine`, que es
  // puro y tiene sus propias pruebas.
  it("no intenta filtrar por línea en la consulta", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new MovementService(client.asSupabase()).balances(ORG);

    expect(client.queries[0].argsOf("or")).toBeUndefined();
    expect(client.queries[0].argsOf("select")?.[0]).not.toContain("items");
  });

  it("explica el fallo en español", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(
      new MovementService(client.asSupabase()).balances(ORG),
    ).rejects.toThrow(/No se pudieron cargar los saldos/);
  });
});

describe("MovementService.balanceFor", () => {
  it("devuelve null cuando el ítem no es un insumo", async () => {
    const client = new FakeClient([{ data: null, error: null }]);
    const balance = await new MovementService(client.asSupabase()).balanceFor(ORG, ITEM);

    expect(balance).toBeNull();
    expect(client.queries[0].has("maybeSingle")).toBe(true);
  });

  it("devuelve el saldo del insumo", async () => {
    const client = new FakeClient([
      {
        data: { item_id: ITEM, organization_id: ORG, balance: "0", min_stock: "40", below_min: true },
        error: null,
      },
    ]);
    const balance = await new MovementService(client.asSupabase()).balanceFor(ORG, ITEM);

    expect(balance).toEqual({
      itemId: ITEM,
      organizationId: ORG,
      balance: 0,
      minStock: 40,
      belowMin: true,
    });
  });

  it("explica el fallo en español", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(
      new MovementService(client.asSupabase()).balanceFor(ORG, ITEM),
    ).rejects.toThrow(/No se pudo cargar el saldo/);
  });
});

describe("MovementService.forItem", () => {
  const row = {
    id: MOVEMENT,
    organization_id: ORG,
    item_id: ITEM,
    variant_id: null,
    kind: "out",
    quantity: "-24.000",
    source_type: "manual",
    source_id: null,
    occurred_at: "2026-09-01T10:00:00.000Z",
    note: "Pedido #1",
    created_by: null,
    created_at: "2026-09-01T10:00:00.000Z",
  };

  it("ordena por la hora del hecho y pagina desde el primer día", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    await new MovementService(client.asSupabase()).forItem(ORG, ITEM);

    const query = client.queries[0];
    expect(query.has("eq", "organization_id", ORG)).toBe(true);
    expect(query.has("eq", "item_id", ITEM)).toBe(true);
    expect(query.has("order", "occurred_at", { ascending: false })).toBe(true);
    expect(query.has("range", 0, 19)).toBe(true);
  });

  it("respeta la página que se le pide", async () => {
    const client = new FakeClient([{ data: [], error: null }]);
    await new MovementService(client.asSupabase()).forItem(ORG, ITEM, {
      limit: 10,
      offset: 20,
    });

    expect(client.queries[0].has("range", 20, 29)).toBe(true);
  });

  it("convierte la cantidad conservando su signo", async () => {
    const client = new FakeClient([{ data: [row], error: null }]);
    const [movement] = await new MovementService(client.asSupabase()).forItem(ORG, ITEM);

    expect(movement.quantity).toBe(-24);
    expect(movement.sourceType).toBe("manual");
    expect(movement.note).toBe("Pedido #1");
  });

  it("explica el fallo en español", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(
      new MovementService(client.asSupabase()).forItem(ORG, ITEM),
    ).rejects.toThrow(/No se pudieron cargar los movimientos/);
  });
});
