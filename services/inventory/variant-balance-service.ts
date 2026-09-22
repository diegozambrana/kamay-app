import type { SupabaseClient } from "@supabase/supabase-js";

import type { VariantBalance } from "@/types";

type VariantBalanceRow = {
  item_id: string;
  variant_id: string | null;
  variant_name: string | null;
  variant_archived_at: string | null;
  balance: number | string | null;
};

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string | null): number {
  if (value === null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Acceso a `item_variant_balances` (`catalog-custom-attributes`, design D6):
 * el saldo de cada variante de un insumo, derivado de sus movimientos. Nada
 * aquí suma ni guarda un saldo: la vista lo deriva y se ejecuta con los
 * permisos de quien consulta.
 */
export class VariantBalanceService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Los saldos de las variantes de un ítem, por nombre, con la fila «Sin
   * variante» al final cuando existe.
   */
  async forItem(organizationId: string, itemId: string): Promise<VariantBalance[]> {
    const { data, error } = await this.supabase
      .from("item_variant_balances")
      .select("item_id, variant_id, variant_name, variant_archived_at, balance")
      // Convención nº 2: la organización, explícita, aunque RLS ya filtre.
      .eq("organization_id", organizationId)
      .eq("item_id", itemId)
      .overrideTypes<VariantBalanceRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar los saldos por variante: ${error.message}`);
    }

    return (data ?? [])
      .map((raw) => {
        const row = raw as VariantBalanceRow;
        return {
          itemId: row.item_id,
          variantId: row.variant_id,
          variantName: row.variant_name,
          variantArchivedAt: row.variant_archived_at,
          balance: toNumber(row.balance),
        };
      })
      .sort((a, b) => {
        if (a.variantId === null) return 1;
        if (b.variantId === null) return -1;
        return (a.variantName ?? "").localeCompare(b.variantName ?? "", "es");
      });
  }
}
