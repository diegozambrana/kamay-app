"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { setItemArchived } from "@/actions/catalog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ITEM_KIND_SINGULAR, SHARED_LINE_LABEL } from "@/lib/catalog/labels";
import { formatDateTime } from "@/lib/format/datetime";
import type {
  ActivityEntry,
  BusinessLine,
  Item,
  ItemVariant,
  Role,
  Unit,
} from "@/types";

import { ItemFormDialog } from "./item-form-dialog";
import { ItemPhotos, type ItemPhoto } from "./item-photos";
import { VariantsList } from "./variants-list";

const ACTION_LABELS: Record<ActivityEntry["action"], string> = {
  created: "Creado",
  updated: "Editado",
  status_changed: "Cambio de estado",
  archived: "Archivado",
  unarchived: "Desarchivado",
};

/**
 * V11 · Detalle de ítem. Datos generales, variantes e historial.
 *
 * Deliberadamente **sin** saldo de inventario, último costo, evolución de
 * precios de compra, proveedores habituales ni tareas relacionadas: son de
 * KAM-18, KAM-19 y KAM-15. Nada de eso se insinúa aquí todavía.
 */
export function ItemDetail({
  item,
  variants,
  photos,
  lines,
  units,
  history,
  role,
  timeZone,
}: {
  item: Item;
  variants: ItemVariant[];
  /** Fotografías vigentes, con su URL ya firmada por el servidor. */
  photos: ItemPhoto[];
  lines: BusinessLine[];
  units: Unit[];
  /** Vacío para el ayudante: la bitácora solo la lee el dueño. */
  history: ActivityEntry[];
  role: Role;
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/catalog">
            <ArrowLeftIcon data-icon="inline-start" />
            Catálogo
          </Link>
        </Button>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{item.name}</h1>
          <Badge variant="outline">{ITEM_KIND_SINGULAR[item.kind]}</Badge>
          {isArchived && (
            <Badge variant="secondary" data-testid="item-archived-badge">
              Archivado
            </Badge>
          )}
        </div>
      </div>

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
                    onClick={() => setArchived(true)}
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

      {/* Historial: convención nº 7, todo sale de `activity_log`. La bitácora
          solo la lee el dueño, así que para el ayudante no hay sección. */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay movimientos registrados.
              </p>
            ) : (
              <Table data-testid="item-history">
                <TableHeader>
                  <TableRow>
                    <TableHead>Qué pasó</TableHead>
                    <TableHead>Campos</TableHead>
                    <TableHead className="text-right">Cuándo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {ACTION_LABELS[entry.action]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.changes
                          ? Object.keys(entry.changes).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <time dateTime={entry.occurredAt}>
                          {formatDateTime(entry.occurredAt, timeZone)}
                        </time>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
