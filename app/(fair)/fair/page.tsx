import { cookies } from "next/headers";

import { lineCookieName, ORG_COOKIE } from "@/constants/auth";
import { FairScreen } from "@/features/fair/fair-screen";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { createClient } from "@/lib/supabase/server";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { SalesChannelService } from "@/services/configuration/sales-channel-service";
import { FairSaleService } from "@/services/fair/fair-sale-service";
import { ALL_LINES } from "@/types";

export const metadata = { title: "Venta rápida · Kamay" };

/**
 * V6 · Venta rápida. Cascarón delgado: compone el módulo de feature y le pasa
 * lo que el servidor ya resolvió.
 *
 * El catálogo se obtiene aquí, con red, y el cliente lo guarda como snapshot
 * para poder abrir la feria sin señal (design.md, decisión 12).
 */
export default async function FairPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const organizationId = cookieStore.get(ORG_COOKIE)?.value ?? "";

  const lines = await new BusinessLineService(supabase).listActive(organizationId);
  const activeLine = resolveActiveLine(
    cookieStore.get(lineCookieName(organizationId))?.value,
    lines,
  );

  const channels = await new SalesChannelService(supabase).listActive(organizationId);

  // Con la línea en «Todas» no hay catálogo que traer: el paso de inicio pide
  // elegir una antes de mostrar la cuadrícula (design.md, decisión 9).
  const products =
    activeLine === ALL_LINES
      ? []
      : await new FairSaleService(supabase).listSellableProducts(
          organizationId,
          activeLine,
        );

  return (
    <FairScreen
      organizationId={organizationId}
      lines={lines}
      activeLine={activeLine}
      channels={channels}
      products={products}
    />
  );
}
