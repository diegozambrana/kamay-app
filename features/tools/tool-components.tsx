"use client";

import type { ComponentType } from "react";

import { PrintCostOrderAction } from "@/tools/print-cost-3d/ui/order-action";
import { PrintCostPage } from "@/tools/print-cost-3d/ui/page";

/**
 * KAM-27 · El montaje de las herramientas: `slug → componente` (design D10).
 *
 * Es el único sitio del núcleo que conoce los componentes de cada herramienta.
 * La búsqueda ocurre **en cliente** porque un componente no cruza del servidor
 * como dato: el servidor decide *si* la herramienta se puede usar y con qué
 * parámetros, y pasa solo el slug.
 */
export type ToolPageProps = {
  /** Los parámetros tal como están guardados; cada herramienta los valida. */
  config: unknown;
  currency: string;
};

const PAGES: Record<string, ComponentType<ToolPageProps>> = {
  "print-cost-3d": PrintCostPage,
};

export function ToolPage({ slug, ...props }: ToolPageProps & { slug: string }) {
  const Page = PAGES[slug];
  return Page ? <Page {...props} /> : null;
}

export type ToolOrderActionProps = ToolPageProps & { orderId: string };

const ORDER_ACTIONS: Record<string, ComponentType<ToolOrderActionProps>> = {
  "print-cost-3d": PrintCostOrderAction,
};

export function ToolOrderAction({ slug, ...props }: ToolOrderActionProps & { slug: string }) {
  const Action = ORDER_ACTIONS[slug];
  return Action ? <Action {...props} /> : null;
}

/** Para la prueba que exige que todo enganche declarado esté montado. */
export const MOUNTED_PAGES: readonly string[] = Object.keys(PAGES);
export const MOUNTED_ORDER_ACTIONS: readonly string[] = Object.keys(ORDER_ACTIONS);
