"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { MainContainer } from "@/components/layout/main-container";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import type { AssetRecovery, LineColor } from "@/types";

import { AssetCard } from "./asset-card";
import { AssetDetailPanel, type AssetDetailView } from "./asset-detail-panel";

/** Un activo tal como lo necesita la tarjeta: su recuperación más su etiqueta. */
export type AssetRowView = AssetRecovery & {
  lineName: string;
  lineColor: LineColor;
  archivedAt: string | null;
};

/**
 * V12 · Activos.
 *
 * Una tarjeta por máquina, con su barra. La línea la pone el selector global
 * —esta pantalla no tiene selector propio— y el filtro "Ver archivados" es el
 * mismo de todo listado del sistema, con su estado en la dirección para que la
 * pantalla sea enlazable.
 *
 * El detalle se abre en un panel lateral y no en otra página: es lo que pide
 * el mapa §7 para V12, y es lo que permite recorrer varias máquinas sin perder
 * la lista de vista.
 */
export function AssetsScreen({
  assets,
  detail,
  timezone,
  includeArchived,
}: {
  assets: readonly AssetRowView[];
  /** El activo abierto en el panel, ya resuelto en el servidor. */
  detail: AssetDetailView | null;
  timezone: string;
  includeArchived: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [showArchived, setShowArchived] = useState(includeArchived);

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/assets?${next.toString()}`);
  }

  return (
    <MainContainer
      title="Activos"
      description="Cuánto lleva devuelto cada máquina del margen de su línea desde que se compró."
      action={
        <Field orientation="horizontal" className="w-fit">
          <Checkbox
            id="assets-archived"
            data-testid="assets-archived"
            checked={showArchived}
            onCheckedChange={(checked) => {
              setShowArchived(checked === true);
              navigate({ archived: checked === true ? "1" : null });
            }}
          />
          <FieldLabel htmlFor="assets-archived">Ver archivados</FieldLabel>
        </Field>
      }
    >
      {assets.length === 0 ? (
        <Empty data-testid="assets-empty">
          <EmptyTitle>Todavía no hay activos</EmptyTitle>
          <EmptyDescription>
            Una máquina es un ítem de tipo activo del catálogo con su costo y su
            fecha de compra declarados. Puedes declararlos desde el detalle del
            ítem, o al registrar la compra.
          </EmptyDescription>
        </Empty>
      ) : (
        // Una columna en el celular y hasta tres en escritorio: las tarjetas se
        // apilan sin desplazamiento horizontal en 390 px.
        <ul
          data-testid="assets-list"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {assets.map((asset) => (
            <AssetCard
              key={asset.itemId}
              asset={asset}
              onOpen={() => navigate({ selected: asset.itemId })}
            />
          ))}
        </ul>
      )}

      <AssetDetailPanel
        detail={detail}
        timezone={timezone}
        onClose={() => navigate({ selected: null })}
      />
    </MainContainer>
  );
}
