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
import { EmptyState } from "@/components/shared/empty-state";
import { FilteredEmptyState } from "@/components/shared/filtered-empty-state";
import { LoadMore } from "@/components/shared/load-more";
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
import { useFilterState, useSearchReset } from "@/hooks/use-filter-state";
import { usePendingToggle } from "@/hooks/use-pending-toggle";
import { attributeFieldsFor } from "@/lib/catalog/attributes";
import { ITEM_KIND_FIELDS } from "@/lib/catalog/fields";
import {
  ITEM_KIND_COPY,
  ITEM_KIND_LABELS,
  NO_CATEGORY_LABEL,
  SHARED_LINE_LABEL,
} from "@/lib/catalog/labels";
import {
  ITEM_KINDS,
  type BusinessLine,
  type Item,
  type ItemCategory,
  type ItemCategoryAttribute,
  type ItemKind,
  type Role,
  type Unit,
} from "@/types";

import { ItemFormDialog } from "./item-form-dialog";
import { ItemThumbnail } from "./item-thumbnail";

const ALL_LINES_OPTION = "all";
const SHARED_OPTION = "shared";
const ALL_CATEGORIES_OPTION = "all";
const NO_CATEGORY_OPTION = "none";

/** Un ítem del listado con su miniatura ya firmada por el servidor. */
export type CatalogRow = Item & {
  photoUrl: string | null;
  /**
   * Si el insumo está por debajo de su mínimo (KAM-18). Lo calcula la vista
   * `item_balances`, no esta pantalla: el panel, el catálogo y V11 leen la
   * misma bandera y no pueden discrepar.
   */
  belowMin?: boolean;
};

/**
 * Los parámetros que estrechan el catálogo: la búsqueda, la línea y la
 * categoría propias de esta pantalla. `kind` es la pestaña —siempre hay una—
 * y `archived` ensancha; ninguno es un filtro (design D2).
 */
const CATALOG_FILTERS = ["q", "line", "category"] as const;

/**
 * Prefijo de los filtros por atributo de lista (`catalog-custom-attributes`,
 * design D8): `attr_<id del atributo>=<opción>`. Son filtros como los demás,
 * pero su lista depende de la categoría elegida.
 */
const ATTRIBUTE_FILTER_PREFIX = "attr_";
const ALL_OPTIONS = "all";

/**
 * V10 · Catálogo. El alcance vive en la dirección (`?kind=&line=&q=&archived=`)
 * para que el listado sea enlazable y el servidor entregue exactamente lo que
 * se pide.
 *
 * Sigue **sin mostrar saldo ni último costo**, y eso no cambió con el
 * inventario: lo que se añadió es un distintivo binario de bajo mínimo. La
 * cifra vive en el detalle, que está a un toque. Poner el número aquí
 * convertiría el catálogo en una pantalla de inventario y arrastraría al
 * ayudante hacia columnas de costo que no debe ver.
 */
export function CatalogScreen({
  items,
  lines,
  units,
  kind,
  lineFilter,
  categoryFilter = ALL_CATEGORIES_OPTION,
  categories = [],
  attributeDefinitions = [],
  attributeFilters = {},
  search,
  includeArchived,
  role,
  activeLineId,
  limit = 50,
  hasMore = false,
}: {
  items: CatalogRow[];
  lines: BusinessLine[];
  units: Unit[];
  kind: ItemKind;
  lineFilter: string;
  /** `"all"`, `"none"` o el id de una categoría de la pestaña. */
  categoryFilter?: string;
  /** Las categorías del tipo de la pestaña, archivadas incluidas. */
  categories?: ItemCategory[];
  /** Los atributos vigentes de esas categorías (`catalog-custom-attributes`). */
  attributeDefinitions?: ItemCategoryAttribute[];
  /** Las opciones elegidas por atributo, ya validadas por la página. */
  attributeFilters?: Record<string, string>;
  search: string;
  includeArchived: boolean;
  role: Role;
  activeLineId: string | null;
  /** Cuántos ítems trae la ventana (KAM-23). */
  limit?: number;
  /** Si el catálogo tiene más de los que se muestran. */
  hasMore?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [showArchived, setShowArchived] = usePendingToggle(includeArchived);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Los filtros por atributo presentes en la dirección cuentan como filtros:
  // «Quitar filtros» los quita junto con la búsqueda, la línea y la categoría.
  const attributeParamKeys = [...params.keys()].filter((key) =>
    key.startsWith(ATTRIBUTE_FILTER_PREFIX),
  );
  const { hasActiveFilters, clearFilters } = useFilterState([
    ...CATALOG_FILTERS,
    ...attributeParamKeys,
  ]);
  const { searchKey, armSearchReset } = useSearchReset(search);

  const isOwner = role === "owner";
  // La pestaña decide qué columnas hay y qué se crea (`ITEM_KIND_FIELDS`).
  const fields = ITEM_KIND_FIELDS[kind];
  const copy = ITEM_KIND_COPY[kind];
  // Se ofrecen las vigentes; con todas se resuelve la categoría actual de una
  // fila que se edita, aunque esté archivada.
  const activeCategories = categories.filter((category) => category.archivedAt === null);
  const categoryOf = (item: CatalogRow | null) =>
    item?.categoryId
      ? (categories.find((category) => category.id === item.categoryId) ?? null)
      : null;
  // Con una categoría elegida, un filtro por cada atributo de lista del ítem.
  // Los de variante, de texto y de número no filtran (D8).
  const attributeFilterFields =
    categoryFilter === ALL_CATEGORIES_OPTION || categoryFilter === NO_CATEGORY_OPTION
      ? []
      : attributeFieldsFor(attributeDefinitions, categoryFilter, "item").filter(
          (field) => field.type === "list",
        );
  /** Cambiar de pestaña o de categoría descarta los filtros por atributo. */
  const withoutAttributeFilters = Object.fromEntries(
    attributeParamKeys.map((key) => [key, null]),
  );
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

  const allColumns: DataTableColumn<CatalogRow>[] = [
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
          {item.belowMin && (
            <Badge variant="destructive" data-testid={`below-min-${item.id}`}>
              Bajo mínimo
            </Badge>
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
  // Solo los productos se venden: en insumos y activos la columna de precio
  // no existe, ni vacía.
  const columns = allColumns.filter(
    (column) => column.id !== "salePrice" || fields.salePrice,
  );

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
        // Cada tipo tiene sus propias categorías: la elegida no sobrevive al
        // cambio de pestaña.
        onValueChange={(value) =>
          value && navigate({ ...withoutAttributeFilters, kind: value, category: null })
        }
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
            key={searchKey}
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

        <Field className="w-52">
          <FieldLabel htmlFor="catalog-category">Categoría</FieldLabel>
          <Select
            value={categoryFilter}
            onValueChange={(value) =>
              navigate({
                ...withoutAttributeFilters,
                category: value === ALL_CATEGORIES_OPTION ? null : value,
              })
            }
          >
            <SelectTrigger id="catalog-category" data-testid="catalog-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_CATEGORIES_OPTION}>
                  Todas las categorías
                </SelectItem>
                <SelectItem value={NO_CATEGORY_OPTION}>{NO_CATEGORY_LABEL}</SelectItem>
                {activeCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {attributeFilterFields.map((field) => (
          <Field key={field.id} className="w-44">
            <FieldLabel htmlFor={`catalog-attr-${field.id}`}>{field.name}</FieldLabel>
            <Select
              value={attributeFilters[field.id] ?? ALL_OPTIONS}
              onValueChange={(value) =>
                navigate({
                  [`${ATTRIBUTE_FILTER_PREFIX}${field.id}`]: value === ALL_OPTIONS ? null : value,
                })
              }
            >
              <SelectTrigger id={`catalog-attr-${field.id}`} data-testid="catalog-attribute-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL_OPTIONS}>Todos</SelectItem>
                  {field.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ))}

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
          {copy.newLabel}
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
        // Lo nuevo se ve aunque caiga fuera de la ventana alfabética: la
        // página lo trae aparte (`joinsCatalogWindow`).
        onCreated={(id) => {
          const next = new URLSearchParams(params.toString());
          next.set("created", id);
          router.replace(`/catalog?${next.toString()}`, { scroll: false });
        }}
        lines={lines}
        units={units}
        kind={kind}
        defaultLineId={activeLineId}
        categories={activeCategories}
        canManageCategories={isOwner}
        attributeDefinitions={attributeDefinitions}
      />

      {editing && (
        <ItemFormDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          item={editing}
          lines={lines}
          units={units}
          kind={editing.kind}
          categories={activeCategories}
          currentCategory={categoryOf(editing)}
          canManageCategories={isOwner}
          attributeDefinitions={attributeDefinitions}
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
        empty={
          hasActiveFilters ? (
            <FilteredEmptyState
              description={`Ninguno de los ${ITEM_KIND_LABELS[kind].toLowerCase()} coincide con la búsqueda o la línea elegidas.`}
              onClearFilters={() => {
                armSearchReset();
                clearFilters();
              }}
            />
          ) : (
            <EmptyState
              title={`Aún no hay ${ITEM_KIND_LABELS[kind].toLowerCase()} en el catálogo`}
              action={
                <Button type="button" onClick={() => setAdding(true)}>
                  {copy.firstLabel}
                </Button>
              }
            />
          )
        }
      />

      {hasMore && (
        <LoadMore limit={limit} shownLabel={`los primeros ${limit} por orden alfabético`} />
      )}
      </div>
    </MainContainer>
  );
}
