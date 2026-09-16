"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { setItemVariantArchived } from "@/actions/catalog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ITEM_KIND_FIELDS } from "@/lib/catalog/fields";
import type { ItemKind, ItemVariant, Role } from "@/types";

import { VariantFormDialog } from "./variant-form-dialog";

/**
 * Variantes de un ítem ('11oz', 'Negro', 'XL'). El ayudante crea y edita;
 * archivar sigue siendo del dueño, igual que en el resto del catálogo.
 *
 * El precio de una variante sigue la regla de su ítem: solo existe en
 * productos (`ITEM_KIND_FIELDS`).
 */
export function VariantsList({
  itemId,
  itemKind,
  variants,
  role,
  readOnly,
}: {
  itemId: string;
  itemKind: ItemKind;
  variants: ItemVariant[];
  role: Role;
  /** El ítem está archivado: no se edita nada suyo hasta desarchivarlo. */
  readOnly: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ItemVariant | null>(null);
  const [pending, startTransition] = useTransition();

  const isOwner = role === "owner";
  const hasPrice = ITEM_KIND_FIELDS[itemKind].salePrice;

  function archive(id: string, archived: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setItemVariantArchived({ id, itemId, archived });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variantes</CardTitle>
        {!readOnly && (
          <CardAction>
            <Button size="sm" onClick={() => setAdding(true)}>
              <PlusIcon data-icon="inline-start" />
              Agregar variante
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo completar la acción</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este ítem no tiene variantes.
          </p>
        ) : (
          <Table data-testid="variant-list">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                {hasPrice && (
                  <TableHead className="text-right">Precio</TableHead>
                )}
                {!readOnly && (
                  <TableHead className="sr-only">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id} data-testid="variant-row">
                  <TableCell className="font-medium">{variant.name}</TableCell>
                  {hasPrice && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {variant.salePrice === null
                        ? "—"
                        : variant.salePrice.toFixed(2)}
                    </TableCell>
                  )}
                  {!readOnly && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(variant)}
                      >
                        Editar
                      </Button>
                      {isOwner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => archive(variant.id, true)}
                        >
                          Archivar
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <VariantFormDialog
        open={adding}
        onOpenChange={setAdding}
        itemId={itemId}
        itemKind={itemKind}
      />
      {/* La clave reinicia el formulario al cambiar de variante editada. */}
      {editing && (
        <VariantFormDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          itemId={itemId}
          itemKind={itemKind}
          variant={editing}
        />
      )}
    </Card>
  );
}
