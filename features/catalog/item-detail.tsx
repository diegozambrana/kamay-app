"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { setItemArchived } from "@/actions/catalog";
import { MainContainer } from "@/components/layout/main-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecordHistory } from "@/components/activity/record-history";
import type { RecordHistory as RecordHistoryData } from "@/services/activity/record-history";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ITEM_KIND_SINGULAR, SHARED_LINE_LABEL } from "@/lib/catalog/labels";
import type {
  AssetDetails,
  BusinessLine,
  InventoryMovement,
  Item,
  ItemBalance,
  ItemVariant,
  Role,
  Unit,
} from "@/types";

import { AssetDetailsForm } from "@/features/assets/asset-details-form";
import { BalanceSection } from "@/features/inventory/balance-section";
import { MovementsSection } from "@/features/inventory/movements-section";
import {
  PriceHistorySection,
  type PurchasePrice,
} from "@/features/inventory/price-history-section";
import { ArchiveWarning } from "@/features/tasks/links/archive-warning";
import { RelatedTasks } from "@/features/tasks/links/related-tasks";
import type { RelatedTask } from "@/services/tasks/task-service";

import { ItemFormDialog } from "./item-form-dialog";
import { ItemPhotos, type ItemPhoto } from "./item-photos";
import { VariantsList } from "./variants-list";

/**
 * V11 · Detalle de ítem. Datos generales, variantes, inventario e historial.
 *
 * Para un insumo muestra además su saldo, sus movimientos y la evolución de
 * precios de compra (KAM-18). Un producto o un activo no lleva ninguna de las
 * tres: no tienen saldo que explicar.
 *
 * La evolución de precios llega o no llega: la página la consulta igual para
 * los dos roles, y para el ayudante RLS devuelve cero filas. Aquí no hay
 * ninguna condición sobre el rol, y no debe haberla (design D9).
 *
 * Siguen **sin** aparecer proveedores habituales ni tareas relacionadas: son
 * de KAM-21.
 */
export function ItemDetail({
  item,
  variants,
  photos,
  lines,
  units,
  history,
  relatedTasks,
  role,
  timeZone,
  balance = null,
  movements = [],
  hasMoreMovements = false,
  prices = [],
  lastCost = null,
  assetDetails = null,
  suppliers = [],
}: {
  item: Item;
  variants: ItemVariant[];
  /** Fotografías vigentes, con su URL ya firmada por el servidor. */
  photos: ItemPhoto[];
  lines: BusinessLine[];
  units: Unit[];
  /** Vacío para el ayudante: la bitácora solo la lee el dueño. */
  history: RecordHistoryData;
  /** Las tareas que apuntan a este ítem (KAM-21). */
  relatedTasks: RelatedTask[];
  role: Role;
  /** Solo para los insumos; `null` en productos y activos. */
  balance?: ItemBalance | null;
  movements?: InventoryMovement[];
  hasMoreMovements?: boolean;
  /** Vacío para el ayudante: RLS no le da los precios de compra. */
  prices?: PurchasePrice[];
  lastCost?: number | null;
  /**
   * Datos de activo del ítem (KAM-19), o `null` si aún no se han declarado.
   * Solo llega para la persona dueña y solo si el ítem es de tipo activo:
   * `asset_details` está *sin acceso* para el ayudante (matriz §16).
   */
  assetDetails?: AssetDetails | null;
  /** Proveedores vigentes, para el formulario de datos del activo. */
  suppliers?: { id: string; name: string }[];
  /** Zona horaria de la organización: la historia se cuenta en hora del taller. */
  timeZone: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isOwner = role === "owner";
  const isArchived = item.archivedAt !== null;
  const line = lines.find((candidate) => candidate.id === item.businessLineId);
  const unit = units.find((candidate) => candidate.id === item.unitId);

  function setArchived(archived: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setItemArchived({ id: item.id, archived });
      if (result?.error) setError(result.error);
    });
  }

  /**
   * Archivar avisa primero qué tareas referencian al ítem (D5). Las tareas ya
   * están cargadas, así que el aviso no cuesta una consulta más.
   *
   * Desarchivar no avisa: no hay nada que romper al devolver un registro.
   */
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  return (
    <MainContainer
      title={
        <span className="flex flex-wrap items-center gap-3">
          <span>{item.name}</span>
          <Badge variant="outline">{ITEM_KIND_SINGULAR[item.kind]}</Badge>
          {isArchived && (
            <Badge variant="secondary" data-testid="item-archived-badge">
              Archivado
            </Badge>
          )}
        </span>
      }
      description={
        <Link href="/catalog" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden />
          Catálogo
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo completar la acción</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Un registro archivado no se edita: la única acción es devolverlo. */}
      {isArchived ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Este ítem está archivado</EmptyTitle>
            <EmptyDescription>
              Para editarlo hay que desarchivarlo primero.
            </EmptyDescription>
          </EmptyHeader>
          {isOwner && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => setArchived(false)}
            >
              Desarchivar
            </Button>
          )}
        </Empty>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Datos generales</CardTitle>
            </CardHeader>
            <CardContent>
              <dl
                data-testid="item-general"
                className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2"
              >
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Línea</dt>
                  <dd data-testid="item-line">
                    <Badge variant="outline">
                      {line?.name ?? SHARED_LINE_LABEL}
                    </Badge>
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Unidad</dt>
                  <dd>{unit?.name ?? "—"}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Categoría</dt>
                  <dd>{item.category ?? "—"}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">
                    Precio de venta referencial
                  </dt>
                  <dd className="tabular-nums">
                    {item.salePrice === null ? "—" : item.salePrice.toFixed(2)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">Mínimo</dt>
                  <dd className="tabular-nums">
                    {item.minStock === null ? "—" : item.minStock}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <dt className="text-muted-foreground">Descripción</dt>
                  <dd>{item.description ?? "—"}</dd>
                </div>
              </dl>

              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => setEditing(true)}>
                  Editar
                </Button>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setConfirmingArchive(true)}
                  >
                    Archivar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <ItemFormDialog
            open={editing}
            onOpenChange={setEditing}
            item={item}
            lines={lines}
            units={units}
            defaultKind={item.kind}
          />
        </>
      )}

      <ItemPhotos
        itemId={item.id}
        photos={photos}
        role={role}
        readOnly={isArchived}
      />

      <VariantsList
        itemId={item.id}
        variants={variants}
        role={role}
        readOnly={isArchived}
      />

      {/* Inventario (KAM-18). Solo los insumos tienen saldo: `item_balances`
          se define sobre `kind = 'supply'`, así que en un producto o un activo
          `balance` llega nulo y estas dos secciones no existen. */}
      {balance && (
        <>
          <BalanceSection
            item={item}
            balance={balance}
            unit={unit}
            readOnly={isArchived}
          />
          <MovementsSection
            movements={movements}
            timeZone={timeZone}
            hasMore={hasMoreMovements}
          />
        </>
      )}

      {/* Activos (KAM-19). El costo y la fecha que KAM-06 aplazó
          explícitamente —"esos datos llegan con los activos"— se declaran y se
          corrigen aquí, sin salir del catálogo. Solo para la persona dueña y
          solo en un ítem de tipo activo: para el ayudante la sección no
          existe, ni vacía ni rotulada. */}
      {isOwner && item.kind === "asset" && (
        <div data-testid="asset-details-section" className="flex flex-col gap-2">
          <AssetDetailsForm
            itemId={item.id}
            acquisitionCost={assetDetails?.acquisitionCost ?? null}
            acquiredOn={assetDetails?.acquiredOn ?? null}
            supplierId={assetDetails?.supplierId ?? null}
            notes={assetDetails?.notes ?? null}
            suppliers={suppliers}
          />
          <Link
            href="/assets"
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Ver la recuperación de inversión de todos los activos
          </Link>
        </div>
      )}

      {/* La evolución de precios se rinde si hay algo que rendir. Para el
          ayudante llega vacía por RLS, no por una condición de rol. */}
      {(prices.length > 0 || lastCost !== null) && (
        <PriceHistorySection
          prices={prices}
          lastCost={lastCost}
          timeZone={timeZone}
        />
      )}

      {/* Tareas relacionadas (KAM-21). KAM-06 prohibía esta sección; el
          delta de esta tarea es quien levanta esa prohibición. */}
      <Card>
        <CardHeader>
          <CardTitle>Tareas relacionadas</CardTitle>
        </CardHeader>
        <CardContent>
          <RelatedTasks tasks={relatedTasks} timezone={timeZone} />
        </CardContent>
      </Card>

      {/* Historial: convención nº 7, todo sale de `activity_log`, por la misma
          lectura y la misma redacción que la bitácora general. La bitácora
          solo la lee el dueño, así que para el ayudante no hay sección.

          Hasta KAM-22 esta tabla listaba los campos como
          `Object.keys(changes).join(", ")`: nombres de columna crudos en
          pantalla, que es justo lo que el requisito prohíbe. */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordHistory
              history={history}
              timezone={timeZone}
              emptyMessage="Todavía no hay movimientos registrados."
            />
          </CardContent>
        </Card>
      )}
      </div>

      <ArchiveWarning
        open={confirmingArchive}
        onOpenChange={setConfirmingArchive}
        label={`«${item.name}»`}
        relatedTasks={relatedTasks}
        onConfirm={() => {
          setConfirmingArchive(false);
          setArchived(true);
        }}
      />

    </MainContainer>
  );
}
