import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

/**
 * Apoyo compartido de las pruebas de integración de KAM-12.
 *
 * **Se escribe como usuario autenticado, no con la clave de servicio.** No es
 * una preferencia: el esquema le revoca `insert` y `update` a `service_role` en
 * toda tabla de negocio (convención nº 2), y está bien que así sea. La
 * consecuencia es que estas pruebas recorren exactamente el mismo camino que
 * la aplicación —RPC con `security invoker`, RLS decidiendo— en vez de uno
 * privilegiado que no prueba lo que importa.
 */

export function localSupabaseEnv(): { url: string; publishableKey: string } {
  const output = execSync("supabase status -o env", { encoding: "utf8" });
  const get = (name: string) =>
    output.match(new RegExp(`^${name}="?([^"\n]+)"?$`, "m"))?.[1];

  const url = process.env.SUPABASE_URL ?? get("API_URL");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? get("PUBLISHABLE_KEY") ?? get("ANON_KEY");

  if (!url || !publishableKey) {
    throw new Error(
      "No se pudo resolver la URL o la clave pública de Supabase local. ¿Está corriendo `supabase start`?",
    );
  }
  return { url, publishableKey };
}

/**
 * La semilla de Geeko Store: la organización con líneas, catálogo y ventas.
 *
 * **Cada archivo de integración vende en su propia línea.** Los archivos
 * corren en paralelo y varias de estas pruebas miden el delta del ingreso de
 * una línea: si dos vendieran en la misma, la venta de una caería entre el
 * «antes» y el «después» de la otra y el resultado sería verde o rojo según
 * quién terminara primero.
 */
export const GEEKO = {
  organizationId: "10000000-0000-0000-0000-000000000003",
  alfareria: "30000000-0000-0000-0000-000000000003",
  sublimacion: "30000000-0000-0000-0000-000000000001",
  tazaDeBarro: "90000000-0000-0000-0000-000000000013",
  tazaPersonalizada: "90000000-0000-0000-0000-000000000011",
  owner: { email: "geeko@kamay.test", password: "kamay123" },
  assistant: { email: "ayudante@kamay.test", password: "kamay123" },
};

/** Un cliente ya autenticado, como el que usa la aplicación. */
export async function signIn(
  credentials: { email: string; password: string } = GEEKO.owner,
): Promise<SupabaseClient> {
  const { url, publishableKey } = localSupabaseEnv();
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false },
    // Node 20 no trae WebSocket nativo; realtime-js lo exige al construir.
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    throw new Error(
      `No se pudo entrar como ${credentials.email}: ${error.message}. ¿Corriste \`supabase db reset\`?`,
    );
  }

  return supabase;
}

/**
 * Suma una columna de `order_totals` para una línea. Las pruebas comparan
 * **deltas** y no valores absolutos: la base de integración conserva lo que
 * escribieron las corridas anteriores, y una aserción absoluta sería verde o
 * roja según el orden en que se ejecutaran.
 */
export async function lineTotals(
  db: SupabaseClient,
  businessLineId: string,
): Promise<{ total: number; paid: number }> {
  const { data, error } = await db
    .from("order_totals")
    .select("total, paid")
    .eq("business_line_id", businessLineId);

  if (error) throw new Error(`No se pudo leer order_totals: ${error.message}`);

  return (data ?? []).reduce(
    (acc, row) => ({
      total: acc.total + Number(row.total),
      paid: acc.paid + Number(row.paid),
    }),
    { total: 0, paid: 0 },
  );
}

/** Registra una venta directa por la vía real y devuelve su identificador. */
export async function sellDirect(
  db: SupabaseClient,
  input: {
    businessLineId: string;
    itemId: string;
    quantity: number;
    unitPrice: number;
    amount?: number;
  },
): Promise<string> {
  const saleId = crypto.randomUUID();

  const { error } = await db.rpc("create_direct_sale", {
    p_sale: {
      id: saleId,
      organization_id: GEEKO.organizationId,
      business_line_id: input.businessLineId,
      occurred_at: new Date().toISOString(),
    },
    p_items: [
      {
        id: crypto.randomUUID(),
        item_id: input.itemId,
        quantity: input.quantity,
        unit_price: input.unitPrice,
      },
    ],
    p_payment:
      input.amount === undefined
        ? null
        : { id: crypto.randomUUID(), amount: input.amount, method: "cash" },
  });

  if (error) throw new Error(`No se pudo registrar la venta: ${error.message}`);

  return saleId;
}
