"use client";

import { ArchiveRestoreIcon, PlusIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { setItemArchived } from "@/actions/catalog";
import {
  DataTable,
  DEFAULT_ROW_ACTIONS,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table/data-table";
import { MainContainer } from "@/components/layout/main-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePendingToggle } from "@/hooks/use-pending-toggle";
import { ITEM_KIND_LABELS, SHARED_LINE_LABEL } from "@/lib/catalog/labels";
import {
  ITEM_KINDS,
  type BusinessLine,
  type Item,
  type ItemKind,
  type Role,
  type Unit,
} from "@/types";

import { ItemFormDialog } from "./item-form-dialog";
import { ItemThumbnail } from "./item-thumbnail";

const ALL_LINES_OPTION = "all";
const SHARED_OPTION = "shared";

/** Un ítem del listado con su miniatura ya firmada por el servidor. */
export type CatalogRow = Item & { photoUrl: string | null };

/**
 * V10 · Catálogo. El alcance vive en la dirección (`?kind=&line=&q=&archived=`)
 * para que el listado sea enlazable y el servidor entregue exactamente lo que
 * se pide. No muestra saldo ni último costo: son datos derivados y llegan con
 * el inventario (KAM-18).
 */
export function CatalogScreen({
  items,
  lines,
  units,
  kind,
  lineFilter,
  search,
  includeArchived,
  role,
  activeLineId,
}: {
  items: CatalogRow[];
  lines: BusinessLine[];
  units: Unit[];
  kind: ItemKind;
  lineFilter: string;
  search: string;
  includeArchived: boolean;
  role: Role;
  activeLineId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [showArchived, setShowArchived] = usePendingToggle(includeArchived);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isOwner = role === "owner";
  const lineName = (id: string | null) =>
    id === null
      ? SHARED_LINE_LABEL
      : (lines.find((line) => line.id === id)?.name ?? SHARED_LINE_LABEL);
  const unitName = (id: string | null) =>
    id === null ? "—" : (units.find((unit) => unit.id === id)?.name ?? "—");

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/catalog?${next.toString()}`);
  }

  const columns: DataTableColumn<CatalogRow>[] = [
    {
      id: "photo",
      label: "Foto",
      hideLabel: true,
      className: "w-px",
      value: (item) => <ItemThumbnail url={item.photoUrl} name={item.name} />,
    },
    {
      id: "name",
      label: "Nombre",
      value: (item) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.name}</span>
          {item.archivedAt !== null && (
            <Badge variant="secondary">Archivado</Badge>
          )}
        </div>
      ),
    },
    {
      id: "unit",
      label: "Unidad",
      value: (item) => (
        <span className="text-muted-foreground">{unitName(item.unitId)}</span>
      ),
    },
    {
      id: "salePrice",
      label: "Precio de venta",
      align: "end",
      value: (item) => (
        <span className="tabular-nums">
          {item.salePrice === null ? "—" : item.salePrice.toFixed(2)}
        </span>
      ),
    },
    {
      id: "line",
      label: "Línea",
      value: (item) => (
        <Badge variant="outline">{lineName(item.businessLineId)}</Badge>
      ),
    },
  ];

  // Ver y Editar son de ambos roles; archivar y desarchivar, solo del dueño
  // (la base lo rechazaría de todos modos). Se ocultan, no se deshabilitan.
  const actions: DataTableAction<CatalogRow>[] = [
    ...(DEFAULT_ROW_ACTIONS as DataTableAction<CatalogRow>[]).map((action) =>
      action.id === "archive"
        ? {
            ...action,
            hidden: (item: CatalogRow) =>
              !isOwner || item.archivedAt !== null,
            confirm: {
              title: "¿Archivar este ítem?",
              description:
                "Dejará de aparecer en el catálogo y en los buscadores, pero seguirá visible en los registros que ya lo referencian. Puedes devolverlo desde el filtro «Ver archivados».",
              actionLabel: "Archivar",
            },
          }
        : { ...action, hidden: (item: CatalogRow) => item.archivedAt !== null },
    ),
    {
      id: "unarchive",
      label: "Desarchivar",
      icon: ArchiveRestoreIcon,
      hidden: (item) => !isOwner || item.archivedAt === null,
    },
    // Un archivado solo se puede ver: editarlo exige desarchivarlo primero.
    {
      id: "view",
      label: "Ver",
      hidden: (item) => item.archivedAt === null,
    },
  ];

  function onAction(actionId: string, item: CatalogRow) {
    setError(null);

    if (actionId === "view") {
      router.push(`/catalog/${item.id}`);
      return;
    }
    if (actionId === "edit") {
      setEditing(item);
      return;
    }

    const archived = actionId === "archive";
    startTransition(async () => {
      const result = await setItemArchived({ id: item.id, archived });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <MainContainer
      title="Catálogo"
      description="Lo que compras, lo que vendes y las máquinas con las que trabajas."
    >
      <div className="flex flex-col gap-4">

      <ToggleGroup
        type="single"
        variant="outline"
        value={kind}
        // Radix emite "" al deseleccionar: el catálogo siempre muestra un tipo.
        onValueChange={(value) => value && navigate({ kind: value })}
        aria-label="Tipo de ítem"
        className="w-fit"
      >
        {ITEM_KINDS.map((candidate) => (
          <ToggleGroupItem key={candidate} value={candidate}>
            {ITEM_KIND_LABELS[candidate]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex flex-wrap items-end gap-3">
        <Field className="w-56">
          <FieldLabel htmlFor="catalog-search">Buscar</FieldLabel>
          <Input
            id="catalog-search"
            data-testid="catalog-search"
            defaultValue={search}
            placeholder="Nombre del ítem"
            onChange={(event) => navigate({ q: event.target.value })}
          />
        </Field>

        <Field className="w-52">
          <FieldLabel htmlFor="catalog-line">Línea</FieldLabel>
          <Select
            value={lineFilter}
            onValueChange={(value) => value && navigate({ line: value })}
          >
            <SelectTrigger id="catalog-line" data-testid="catalog-line">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_LINES_OPTION}>
                  Todas las líneas
                </SelectItem>
                <SelectItem value={SHARED_OPTION}>
                  {SHARED_LINE_LABEL}
                </SelectItem>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field orientation="horizontal" className="w-fit pb-2">
          <Checkbox
            id="catalog-archived"
            data-testid="catalog-archived"
            checked={showArchived}
            onCheckedChange={(checked) => {
              setShowArchived(checked === true);
              navigate({ archived: checked === true ? "1" : null });
            }}
          />
          <FieldLabel htmlFor="catalog-archived">Ver archivados</FieldLabel>
        </Field>

        <Button className="ml-auto" onClick={() => setAdding(true)}>
          <PlusIcon data-icon="inline-start" />
          Nuevo ítem
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo completar la acción</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ItemFormDialog
        open={adding}
        onOpenChange={setAdding}
        lines={lines}
        units={units}
        defaultKind={kind}
        defaultLineId={activeLineId}
      />

      {editing && (
        <ItemFormDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          item={editing}
          lines={lines}
          units={units}
          defaultKind={editing.kind}
        />
      )}

      <DataTable
        data-testid="catalog-list"
        columns={columns}
        rows={items}
        rowKey={(item) => item.id}
        actions={actions}
        onAction={onAction}
        rowProps={(item) => ({
          "data-testid": "catalog-row",
          "data-archived": item.archivedAt !== null,
          className: item.archivedAt !== null ? "text-muted-foreground" : undefined,
        })}
        empty={{
          title: "Nada por aquí",
          description: `No hay ${ITEM_KIND_LABELS[kind].toLowerCase()} que coincidan con los filtros.`,
        }}
      />
      </div>
    </MainContainer>
  );
}
