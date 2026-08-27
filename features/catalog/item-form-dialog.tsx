"use client";

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
import { ITEM_KIND_SINGULAR, SHARED_LINE_LABEL } from "@/lib/catalog/labels";
import { ITEM_PHOTO_ACCEPT } from "@/lib/catalog/photos";
import { itemFormSchema } from "@/lib/catalog/schema";
import {
  ITEM_KINDS,
  type BusinessLine,
  type Item,
  type ItemKind,
  type Unit,
} from "@/types";

/** "Compartido" y "Sin unidad" son opciones con nombre, no valores vacíos. */
const SHARED = "shared";
const NO_UNIT = "none";

/**
 * Alta y edición de ítem en un diálogo. El identificador se genera aquí, en el
 * cliente (convención nº 9): es lo que permitirá crear sin conexión en KAM-11.
 *
 * Los desplegables son controlados: el `Select` de shadcn no es un `<select>`
 * nativo, así que su valor no llega por `FormData` y se lleva en estado.
 */
export function ItemFormDialog({
  open,
  onOpenChange,
  item,
  lines,
  units,
  defaultKind,
  defaultLineId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item;
  lines: BusinessLine[];
  units: Unit[];
  defaultKind: ItemKind;
  /** Línea activa del selector global: llega preseleccionada (D5). */
  defaultLineId?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState<ItemKind>(item?.kind ?? defaultKind);
  const [lineId, setLineId] = useState(
    item ? (item.businessLineId ?? SHARED) : (defaultLineId ?? SHARED),
  );
  const [unitId, setUnitId] = useState(item?.unitId ?? NO_UNIT);
  const [photos, setPhotos] = useState<File[]>([]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const parsed = itemFormSchema.safeParse({
      name: String(data.get("name") ?? ""),
      kind,
      businessLineId: lineId === SHARED ? null : lineId,
      unitId: unitId === NO_UNIT ? null : unitId,
      category: String(data.get("category") ?? ""),
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

      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} data-testid="item-form">
          <DialogHeader>
            <DialogTitle>{item ? "Editar ítem" : "Nuevo ítem"}</DialogTitle>
            <DialogDescription>
              Lo que compras, lo que vendes o una máquina del taller.
            </DialogDescription>
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
                <FieldLabel htmlFor="item-kind">Tipo</FieldLabel>
                <Select
                  value={kind}
                  onValueChange={(value) => setKind(value as ItemKind)}
                >
                  <SelectTrigger id="item-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ITEM_KINDS.map((candidate) => (
                        <SelectItem key={candidate} value={candidate}>
                          {ITEM_KIND_SINGULAR[candidate]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

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
                <Input
                  id="item-category"
                  name="category"
                  defaultValue={item?.category ?? ""}
                />
              </Field>

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

              <Field>
                <FieldLabel htmlFor="item-min-stock">Mínimo</FieldLabel>
                <Input
                  id="item-min-stock"
                  name="minStock"
                  inputMode="decimal"
                  defaultValue={item?.minStock ?? ""}
                />
              </Field>
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
              {item ? "Guardar cambios" : "Crear ítem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
