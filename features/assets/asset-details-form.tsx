"use client";

import { useState, useTransition } from "react";

import { saveAssetDetails } from "@/actions/assets";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { assetDetailsSchema } from "@/lib/assets/schema";

/** "Sin proveedor" es una opción con nombre, no un valor vacío. */
const NO_SUPPLIER = "none";

/**
 * Los datos declarados de un activo: costo, fecha, proveedor y notas.
 *
 * El mismo formulario declara por primera vez y corrige después — la persona
 * no distingue entre las dos cosas y la base tampoco (`upsert`). Sirve tanto
 * al panel de V12 como al detalle del ítem en V11, que es lo que evita dos
 * formularios que se desincronizan.
 *
 * El costo es editable siempre, incluso cuando vino prellenado de una compra:
 * una compra puede traer la máquina y sus accesorios en el mismo documento
 * (design D3).
 */
export function AssetDetailsForm({
  itemId,
  acquisitionCost,
  acquiredOn,
  supplierId,
  notes,
  suppliers,
  onSaved,
}: {
  itemId: string;
  acquisitionCost: number | null;
  acquiredOn: string | null;
  supplierId: string | null;
  notes: string | null;
  suppliers: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [supplier, setSupplier] = useState(supplierId ?? NO_SUPPLIER);

  const declared = acquisitionCost !== null && acquiredOn !== null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const parsed = assetDetailsSchema.safeParse({
      itemId,
      acquisitionCost: String(data.get("acquisitionCost") ?? ""),
      acquiredOn: String(data.get("acquiredOn") ?? ""),
      supplierId: supplier === NO_SUPPLIER ? null : supplier,
      notes: String(data.get("notes") ?? ""),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await saveAssetDetails(parsed.data);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved?.();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{declared ? "Datos del activo" : "Declarar como activo"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} data-testid="asset-details-form">
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>No se pudo guardar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Field>
              <FieldLabel htmlFor="acquisitionCost">Costo de adquisición</FieldLabel>
              <Input
                id="acquisitionCost"
                name="acquisitionCost"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                defaultValue={acquisitionCost ?? ""}
                required
              />
              <FieldDescription>
                Lo que costó la máquina. Es la cifra contra la que se mide si ya
                se pagó sola.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="acquiredOn">Fecha de compra</FieldLabel>
              <Input
                id="acquiredOn"
                name="acquiredOn"
                type="date"
                defaultValue={acquiredOn ?? ""}
                required
              />
              <FieldDescription>
                Desde este día se cuenta el margen de su línea.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="asset-supplier">Proveedor</FieldLabel>
              <Select value={supplier} onValueChange={(value) => value && setSupplier(value)}>
                <SelectTrigger id="asset-supplier" data-testid="asset-supplier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NO_SUPPLIER}>Sin proveedor</SelectItem>
                    {suppliers.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="asset-notes">Notas</FieldLabel>
              <Textarea id="asset-notes" name="notes" rows={2} defaultValue={notes ?? ""} />
            </Field>

            <Button type="submit" disabled={pending}>
              {declared ? "Guardar cambios" : "Declarar activo"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
