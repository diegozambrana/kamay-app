"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { createItem, updateItem, uploadItemPhoto } from "@/actions/catalog";
import { FileDropzone } from "@/components/file-dropzone/file-dropzone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ITEM_KIND_FIELDS } from "@/lib/catalog/fields";
import {
  ITEM_CATEGORY_COPY,
  ITEM_KIND_COPY,
  NO_CATEGORY_LABEL,
  SHARED_LINE_LABEL,
} from "@/lib/catalog/labels";
import { ITEM_PHOTO_ACCEPT } from "@/lib/catalog/photos";
import { itemFormSchema } from "@/lib/catalog/schema";
import type { BusinessLine, Item, ItemCategory, ItemKind, Unit } from "@/types";

/** "Compartido", "Sin unidad" y "Sin categoría" son opciones con nombre, no valores vacíos. */
const SHARED = "shared";
const NO_UNIT = "none";
const NO_CATEGORY = "none";

/**
 * Alta y edición de ítem en un diálogo. El identificador se genera aquí, en el
 * cliente (convención nº 9): es lo que permitirá crear sin conexión en KAM-11.
 *
 * El tipo no se elige aquí: al crear lo decide la pestaña del catálogo y al
 * editar es el del ítem, que ya no cambia. Por eso no hay selector de tipo, y
 * los campos que se muestran son los que ese tipo usa (`ITEM_KIND_FIELDS`).
 *
 * Los desplegables son controlados: el `Select` de shadcn no es un `<select>`
 * nativo, así que su valor no llega por `FormData` y se lleva en estado.
 */
export function ItemFormDialog({
  open,
  onOpenChange,
  onCreated,
  item,
  lines,
  units,
  kind,
  defaultLineId,
  categories = [],
  currentCategory = null,
  canManageCategories = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tras crear —no al editar—, con el id del ítem nuevo. */
  onCreated?: (id: string) => void;
  item?: Item;
  lines: BusinessLine[];
  units: Unit[];
  /** El tipo del ítem: el de la pestaña al crear, el guardado al editar. */
  kind: ItemKind;
  /** Línea activa del selector global: llega preseleccionada (D5). */
  defaultLineId?: string | null;
  /** Las categorías vigentes del tipo, por nombre. */
  categories?: ItemCategory[];
  /**
   * La categoría que el ítem ya tiene, vigente o archivada. Una archivada se
   * sigue mostrando como valor actual y se conserva al guardar, pero no se
   * ofrece a los demás ítems.
   */
  currentCategory?: ItemCategory | null;
  /** La dueña recibe el enlace a Configuración cuando el tipo no tiene categorías. */
  canManageCategories?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fields = ITEM_KIND_FIELDS[kind];
  const copy = ITEM_KIND_COPY[kind];
  const [lineId, setLineId] = useState(
    item ? (item.businessLineId ?? SHARED) : (defaultLineId ?? SHARED),
  );
  const [unitId, setUnitId] = useState(item?.unitId ?? NO_UNIT);
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? NO_CATEGORY);
  const archivedCurrent =
    currentCategory && currentCategory.archivedAt !== null ? currentCategory : null;
  const categoryCopy = ITEM_CATEGORY_COPY[kind];
  const [photos, setPhotos] = useState<File[]>([]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const parsed = itemFormSchema.safeParse({
      name: String(data.get("name") ?? ""),
      kind,
      businessLineId: lineId === SHARED ? null : lineId,
      unitId: unitId === NO_UNIT ? null : unitId,
      categoryId: categoryId === NO_CATEGORY ? null : categoryId,
      description: String(data.get("description") ?? ""),
      salePrice: String(data.get("salePrice") ?? ""),
      minStock: String(data.get("minStock") ?? ""),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const values = { ...parsed.data };
      const itemId = item?.id ?? crypto.randomUUID();
      const result = item
        ? await updateItem({ ...values, id: itemId })
        : await createItem({ ...values, id: itemId });

      if (result?.error) {
        setError(result.error);
        return;
      }

      // La foto va después y por separado: si falla, el ítem ya está
      // guardado y solo se reintenta la foto, en vez de perder el formulario.
      if (photos.length > 0) {
        const body = new FormData();
        body.set("itemId", itemId);
        body.set("file", photos[0]);
        const upload = await uploadItemPhoto(body);
        if (upload?.error) {
          setError(`El ítem se guardó, pero la foto no: ${upload.error}`);
          setPhotos([]);
          return;
        }
      }

      if (!item) onCreated?.(itemId);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} data-testid="item-form">
          <DialogHeader>
            <DialogTitle>{item ? copy.editLabel : copy.newLabel}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>No se pudo guardar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel htmlFor="item-name">Nombre</FieldLabel>
              <Input
                id="item-name"
                name="name"
                defaultValue={item?.name}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="item-line">Línea</FieldLabel>
                <Select value={lineId} onValueChange={setLineId}>
                  <SelectTrigger id="item-line">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={SHARED}>
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
                <FieldDescription>
                  Sin línea, el ítem sirve a todas.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="item-unit">Unidad</FieldLabel>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger id="item-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_UNIT}>Sin unidad</SelectItem>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="item-category">Categoría</FieldLabel>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="item-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_CATEGORY}>{NO_CATEGORY_LABEL}</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                      {archivedCurrent && (
                        <SelectItem value={archivedCurrent.id}>
                          {archivedCurrent.name} (archivada)
                        </SelectItem>
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {categories.length === 0 && (
                  <FieldDescription data-testid="item-category-empty">
                    {categoryCopy.none}{" "}
                    {canManageCategories ? (
                      <Link
                        href={`/settings/item-categories?kind=${kind}`}
                        className="underline underline-offset-4"
                      >
                        Se definen en Configuración › Categorías de ítem
                      </Link>
                    ) : (
                      "La persona dueña las define en Configuración."
                    )}
                  </FieldDescription>
                )}
              </Field>

              {fields.salePrice && (
                <Field>
                  <FieldLabel htmlFor="item-sale-price">
                    Precio de venta referencial
                  </FieldLabel>
                  <Input
                    id="item-sale-price"
                    name="salePrice"
                    inputMode="decimal"
                    defaultValue={item?.salePrice ?? ""}
                  />
                  <FieldDescription>No es el costo de compra.</FieldDescription>
                </Field>
              )}

              {fields.minStock && (
                <Field>
                  <FieldLabel htmlFor="item-min-stock">Mínimo</FieldLabel>
                  <Input
                    id="item-min-stock"
                    name="minStock"
                    inputMode="decimal"
                    defaultValue={item?.minStock ?? ""}
                  />
                </Field>
              )}
            </div>

            <Field>
              <FieldLabel htmlFor="item-description">Descripción</FieldLabel>
              <Textarea
                id="item-description"
                name="description"
                rows={3}
                defaultValue={item?.description ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="item-photo">Fotografía</FieldLabel>
              <FileDropzone
                value={photos}
                onChange={setPhotos}
                accept={ITEM_PHOTO_ACCEPT}
                label="Arrastra la foto del ítem"
                disabled={pending}
              />
              <FieldDescription>
                Se verá como miniatura en el catálogo.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {item ? "Guardar cambios" : copy.createLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
