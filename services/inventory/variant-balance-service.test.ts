import { describe, expect, it } from "vitest";

import { FakeClient } from "@/tests/factories/supabase-fake";

import { VariantBalanceService } from "./variant-balance-service";

const ORG = "11111111-1111-1111-1111-111111111111";
const ITEM = "22222222-2222-2222-2222-222222222222";

describe("VariantBalanceService", () => {
  it("lee la vista del ítem en su organización, sin perder precisión", async () => {
    const client = new FakeClient([
      {
        data: [
          { item_id: ITEM, variant_id: "v-rojo", variant_name: "Rojo", variant_archived_at: null, balance: "0.800" },
          { item_id: ITEM, variant_id: null, variant_name: null, variant_archived_at: null, balance: "-0.400" },
          { item_id: ITEM, variant_id: "v-negro", variant_name: "Negro", variant_archived_at: null, balance: "1.500" },
        ],
        error: null,
      },
    ]);

    const balances = await new VariantBalanceService(client.asSupabase()).forItem(ORG, ITEM);

    expect(client.tables[0]).toBe("item_variant_balances");
    expect(client.queries[0].has("eq", "organization_id", ORG)).toBe(true);
    expect(client.queries[0].has("eq", "item_id", ITEM)).toBe(true);
    expect(balances).toEqual([
      { itemId: ITEM, variantId: "v-negro", variantName: "Negro", variantArchivedAt: null, balance: 1.5 },
      { itemId: ITEM, variantId: "v-rojo", variantName: "Rojo", variantArchivedAt: null, balance: 0.8 },
      { itemId: ITEM, variantId: null, variantName: null, variantArchivedAt: null, balance: -0.4 },
    ]);
  });

  it("un error de la base se informa", async () => {
    const client = new FakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(new VariantBalanceService(client.asSupabase()).forItem(ORG, ITEM)).rejects.toThrow(
      "boom",
    );
  });
});
