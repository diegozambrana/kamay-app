"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import {
  createOrder,
  setOrderAttachmentArchived,
  updateOrder,
  uploadOrderAttachment,
} from "@/actions/orders";
import { FileDropzone } from "@/components/file-dropzone/file-dropzone";
import { MainContainer } from "@/components/layout/main-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ContactCombobox } from "@/features/contacts/contact-combobox";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { IMAGE_ACCEPT, MAX_ATTACHMENTS_PER_RECORD } from "@/lib/catalog/photos";
import type { PickableItem } from "@/lib/orders/lines";
import {
  orderFormSchema,
  type OrderFormInput,
  type OrderFormValues,
} from "@/lib/orders/schema";
import { cn } from "@/lib/utils";
import type {
  BusinessLine,
  Contact,
  DeliveryMode,
  SalesChannel,
} from "@/types";

import { DiscardGuard } from "./discard-guard";
import { DueDateField } from "./due-date-field";
import {
  OrderLinesEditor,
  type EditorLine,
  type LineErrors,
  type LineNames,
} from "./order-lines-editor";

/**
 * El estado del formulario **es** la entrada del esquema, no un tipo paralelo:
 * los números y los opcionales llegan como texto y es Zod quien los convierte
 * al validar. Mantenerlos como el mismo tipo es lo que permite que
 * `zodResolver` encaje sin conversiones a mano.
 *
 * Los nombres del catálogo viven aparte (`names`) y no aquí: son para mostrar
 * y no deben viajar al servidor.
 */
export type OrderFormState = OrderFormInput;

/** Un adjunto ya guardado, con su URL firmada. */
export type OrderAttachmentView = {
  id: string;
  fileName: string;
  url: string | null;
};

/** Lo que devuelve un guardado exitoso, en cualquiera de los dos modos. */
type Saved = { orderId: string; code: number };

const DELIVERY_LABELS: Record<DeliveryMode, string> = {
  pickup: "Recojo",
  delivery: "Delivery",
};

/** Un pedido en blanco conserva línea y canal: es lo que no cambia entre dos. */
function blankAfter(previous: OrderFormState): OrderFormState {
  return {
    // Identificadores nuevos: el siguiente pedido no puede reusar los del
    // anterior, que ya están guardados (convención nº 9).
    id: crypto.randomUUID(),
    businessLineId: previous.businessLineId,
    contactId: "",
    salesChannelId: previous.salesChannelId,
    deliveryMode: null,
    dueDate: null,
    notes: "",
    occurredAt: new Date().toISOString(),
    items: [],
  };
}

/** Los errores de cada línea, si el array trae alguno. */
function lineIssuesOf(items: unknown): (LineErrors | undefined)[] {
  if (!Array.isArray(items)) return [];

  return items.map((issue) => {
    if (!issue) return undefined;
    const line = issue as Record<string, { message?: string } | undefined>;
    return {
      quantity: line.quantity?.message,
      unitPrice: line.unitPrice?.message,
      description: line.description?.message,
    };
  });
}

/**
 * V5 · Nuevo pedido, y la edición del mismo pedido.
 *
 * Un solo componente con dos modos (design.md D6): el editor de líneas, el
 * buscador de cliente y la guardia de descarte son idénticos, y lo único que
 * cambia es que la línea de negocio se elige al crear y solo se muestra al
 * editar — cambiarla movería el pedido a otro juego de estados.
 *
 * El estado inicial no aparece por ninguna parte: lo decide la base desde el
 * juego de la línea (design.md D3).
 */
export function OrderForm({
  mode,
  defaultValues,
  initialNames = {},
  lines,
  channels,
  contacts,
  products,
  today,
  attachments = [],
  code,
}: {
  mode: "create" | "edit";
  defaultValues: OrderFormState;
  initialNames?: Record<string, LineNames>;
  lines: BusinessLine[];
  channels: SalesChannel[];
  contacts: Contact[];
  products: PickableItem[];
  today: string;
  attachments?: OrderAttachmentView[];
  code?: number;
}) {
  const router = useRouter();

  const form = useForm<OrderFormState, unknown, OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues,
  });

  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
  } = form;

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "items",
    // Sin esto, `useFieldArray` pisaría nuestro `id` con el suyo, y ese `id`
    // es el que la edición usa para saber qué línea ya existía.
    keyName: "_key",
  });

  const [names, setNames] = useState<Record<string, LineNames>>(initialNames);
  const [selected, setSelected] = useState<Contact | null>(
    contacts.find((contact) => contact.id === defaultValues.contactId) ?? null,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Un pedido guardado cuyos adjuntos fallaron: existe, pero seguimos aquí. */
  const [savedId, setSavedId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);

  // `useWatch` y no `watch()`: se suscribe por campo y deja que el compilador
  // de React memoice el componente, que con `watch()` no puede.
  const businessLineId = useWatch({ control, name: "businessLineId" });
  const currentItems = useWatch({ control, name: "items" });
  const dueDate = useWatch({ control, name: "dueDate" });
  const salesChannelId = useWatch({ control, name: "salesChannelId" });
  const deliveryMode = useWatch({ control, name: "deliveryMode" });

  const activeLine = lines.find((line) => line.id === businessLineId) ?? null;

  // `fields` da las claves estables de React; `currentItems`, lo que hay
  // escrito ahora mismo en cada campo. Aquí se normalizan los opcionales del
  // esquema a lo que el editor rinde: un `<input>` controlado no admite nulo.
  const editorLines: EditorLine[] = fields.map((field, index) => {
    const line = currentItems?.[index] ?? field;
    return {
      id: line.id,
      itemId: line.itemId || null,
      variantId: line.variantId || null,
      description: line.description ?? "",
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    };
  });

  const visibleAttachments = attachments.filter(
    (attachment) => !removed.includes(attachment.id),
  );
  const attachmentRoom = MAX_ATTACHMENTS_PER_RECORD - visibleAttachments.length;

  /**
   * Cambiar la línea al crear puede dejar líneas de pedido huérfanas: un
   * producto de Sublimación no se vende en un pedido de Alfarería. Se quitan
   * y se avisa, en vez de guardarlas y que el problema aparezca más tarde.
   */
  function changeBusinessLine(nextId: string) {
    setValue("businessLineId", nextId, {
      shouldDirty: true,
      shouldValidate: true,
    });

    const current = getValues("items");
    const kept = current.filter((line) => {
      // Una línea libre no pertenece a ningún catálogo: sirve para cualquiera.
      if (!line.itemId) return true;
      const product = products.find((item) => item.id === line.itemId);
      if (!product) return true;
      return product.businessLineId === null || product.businessLineId === nextId;
    });

    if (kept.length !== current.length) {
      replace(kept);
      const dropped = current.length - kept.length;
      setNotice(
        dropped === 1
          ? "Se quitó una línea que no pertenece a esta línea de negocio."
          : `Se quitaron ${dropped} líneas que no pertenecen a esta línea de negocio.`,
      );
    }
  }

  function addLine(line: EditorLine, displayNames: LineNames) {
    append(line);
    setNames((previous) => ({ ...previous, [line.id]: displayNames }));
    setNotice(null);
  }

  /**
   * Se escribe campo a campo con `setValue` y no con el `update` de
   * `useFieldArray`: `update` vuelve a montar la fila y el cursor saltaría
   * fuera del campo en cada tecla.
   */
  function updateLine(index: number, patch: Partial<EditorLine>) {
    if (patch.quantity !== undefined) {
      setValue(`items.${index}.quantity`, patch.quantity, { shouldDirty: true });
    }
    if (patch.unitPrice !== undefined) {
      setValue(`items.${index}.unitPrice`, patch.unitPrice, {
        shouldDirty: true,
      });
    }
    if (patch.description !== undefined) {
      setValue(`items.${index}.description`, patch.description, {
        shouldDirty: true,
      });
    }
  }

  /**
   * Los adjuntos se suben después de guardar (design.md D10): un `File` no
   * cabe en la llamada del pedido, y un pedido no debe perderse por una foto.
   * Devuelve los nombres de los que fallaron.
   */
  async function uploadFiles(orderId: string): Promise<string[]> {
    const failed: string[] = [];

    for (const file of files) {
      const body = new FormData();
      body.set("orderId", orderId);
      body.set("file", file);
      const result = await uploadOrderAttachment(body);
      if (result?.error) failed.push(file.name);
    }

    setFiles([]);
    return failed;
  }

  async function removeAttachment(attachment: OrderAttachmentView) {
    setError(null);
    const result = await setOrderAttachmentArchived({
      id: attachment.id,
      orderId: getValues("id"),
      archived: true,
    });

    if (result?.error) {
      setError(result.error);
      return;
    }
    setRemoved((previous) => [...previous, attachment.id]);
  }

  async function persist(parsed: OrderFormValues): Promise<Saved | null> {
    if (mode === "create") {
      const result = await createOrder(parsed);
      if ("error" in result) {
        setError(result.error);
        return null;
      }
      return { orderId: result.orderId, code: result.code };
    }

    const result = await updateOrder(parsed);
    if (result?.error) {
      setError(result.error);
      return null;
    }
    return { orderId: parsed.id, code: code ?? 0 };
  }

  const submit = (andAnother: boolean) =>
    handleSubmit(async (parsed) => {
      setError(null);
      setNotice(null);
      setSavedId(null);

      const saved = await persist(parsed);
      if (!saved) return;

      const failed = await uploadFiles(saved.orderId);

      if (failed.length > 0) {
        // El pedido ya existe: salir de aquí no debe volver a preguntar.
        reset(getValues());
        setSavedId(saved.orderId);
        setError(
          failed.length === 1
            ? `El pedido #${saved.code} se guardó, pero esta imagen no: ${failed[0]}.`
            : `El pedido #${saved.code} se guardó, pero estas imágenes no: ${failed.join(", ")}.`,
        );
        return;
      }

      if (mode === "create" && andAnother) {
        reset(blankAfter(getValues()));
        setNames({});
        setSelected(null);
        setNotice(`Pedido #${saved.code} guardado. Puedes registrar otro.`);
        document.getElementById("contact-combobox-input")?.focus();
        return;
      }

      // Limpia `isDirty` antes de navegar: la guardia de descarte no debe
      // preguntar después de un guardado exitoso.
      reset(getValues());
      router.push(`/orders/${saved.orderId}`);
    });

  return (
    <MainContainer
      title={mode === "create" ? "Nuevo pedido" : `Editar pedido #${code ?? ""}`}
      description={
        mode === "create"
          ? "Cliente y al menos una línea. Todo lo demás puede esperar."
          : "La línea de negocio y el estado no se cambian desde aquí."
      }
    >
      <form
        data-testid="order-form"
        className="flex flex-col gap-4"
        onSubmit={submit(false)}
      >
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>
              {savedId ? "El pedido se guardó, con un aviso" : "No se pudo guardar"}
            </AlertTitle>
            <AlertDescription>
              {error}
              {savedId && (
                <>
                  {" "}
                  <Link href={`/orders/${savedId}`} className="underline">
                    Abrir el pedido
                  </Link>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert data-testid="order-form-notice">
            <AlertTitle>Listo</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Líneas del pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderLinesEditor
                lines={editorLines}
                names={names}
                items={products}
                businessLineId={businessLineId || null}
                disabled={isSubmitting}
                error={errors.items?.message ?? errors.items?.root?.message}
                lineErrors={lineIssuesOf(errors.items)}
                onAdd={addLine}
                onUpdate={updateLine}
                onRemove={remove}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos del pedido</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* La línea se elige al crear y solo se muestra al editar:
                  cambiarla movería el pedido a otro juego de estados. */}
              {mode === "create" ? (
                <Field data-invalid={errors.businessLineId ? true : undefined}>
                  <FieldLabel htmlFor="order-line">Línea de negocio</FieldLabel>
                  <Select
                    value={businessLineId || undefined}
                    disabled={isSubmitting}
                    onValueChange={changeBusinessLine}
                  >
                    <SelectTrigger
                      id="order-line"
                      data-testid="line-select"
                      aria-invalid={errors.businessLineId ? true : undefined}
                    >
                      <SelectValue placeholder="Elige una línea" />
                    </SelectTrigger>
                    <SelectContent>
                      {lines.map((line) => (
                        <SelectItem key={line.id} value={line.id}>
                          {line.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.businessLineId && (
                    <FieldError data-testid="line-error">
                      {errors.businessLineId.message}
                    </FieldError>
                  )}
                </Field>
              ) : (
                <Field>
                  <FieldLabel>Línea de negocio</FieldLabel>
                  <p data-testid="line-label">
                    {activeLine ? (
                      <Badge variant="secondary" className="gap-1.5">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            lineColorClasses(activeLine.color).dot,
                          )}
                        />
                        {activeLine.name}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </p>
                </Field>
              )}

              <Field data-invalid={errors.contactId ? true : undefined}>
                <ContactCombobox
                  contacts={contacts}
                  role="customer"
                  label="Cliente"
                  value={selected}
                  onSelect={(contact) => {
                    setSelected(contact);
                    setValue("contactId", contact.id, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                />
                {errors.contactId && (
                  <FieldError data-testid="contact-error">
                    {errors.contactId.message}
                  </FieldError>
                )}
              </Field>

              <DueDateField
                value={dueDate ?? null}
                today={today}
                disabled={isSubmitting}
                error={errors.dueDate?.message}
                onChange={(value) =>
                  setValue("dueDate", value, { shouldDirty: true })
                }
              />

              <Field>
                <FieldLabel htmlFor="order-channel">Canal de venta</FieldLabel>
                <Select
                  value={salesChannelId ?? undefined}
                  disabled={isSubmitting}
                  onValueChange={(value) =>
                    setValue("salesChannelId", value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="order-channel" data-testid="channel-select">
                    <SelectValue placeholder="Sin canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Modo de entrega</FieldLabel>
                {/* Deseleccionable a propósito: no saber todavía cómo se
                    entrega es un estado legítimo del pedido. */}
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={deliveryMode ?? ""}
                  data-testid="delivery-toggle"
                  onValueChange={(value) =>
                    setValue(
                      "deliveryMode",
                      value === "" ? null : (value as DeliveryMode),
                      { shouldDirty: true },
                    )
                  }
                >
                  {(Object.keys(DELIVERY_LABELS) as DeliveryMode[]).map(
                    (option) => (
                      <ToggleGroupItem key={option} value={option}>
                        {DELIVERY_LABELS[option]}
                      </ToggleGroupItem>
                    ),
                  )}
                </ToggleGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="order-notes">Nota</FieldLabel>
                <Textarea
                  id="order-notes"
                  rows={3}
                  disabled={isSubmitting}
                  placeholder="Lo que haga falta recordar de este pedido"
                  {...register("notes")}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Imágenes de referencia</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {visibleAttachments.length > 0 && (
              <ul data-testid="order-attachments" className="flex flex-wrap gap-3">
                {visibleAttachments.map((attachment) => (
                  <li key={attachment.id} className="flex w-40 flex-col gap-2">
                    {attachment.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL firmada y efímera: no pasa por el optimizador
                      <img
                        src={attachment.url}
                        alt={attachment.fileName}
                        className="h-28 w-40 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="flex h-28 w-40 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                        No disponible
                      </div>
                    )}
                    <span className="truncate text-xs text-muted-foreground">
                      {attachment.fileName}
                    </span>
                    {/* Quitar es archivar: el archivo no se borra. Disponible
                        para ambos roles, porque es parte del pedido. */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => removeAttachment(attachment)}
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <FileDropzone
              value={files}
              onChange={setFiles}
              accept={IMAGE_ACCEPT}
              maxFiles={Math.max(attachmentRoom, 0)}
              disabled={isSubmitting || attachmentRoom <= 0}
              label="Arrastra las imágenes de referencia"
              description={`Hasta ${MAX_ATTACHMENTS_PER_RECORD} imágenes por pedido, 5 MB cada una.`}
            />
          </CardContent>
        </Card>

        {/* Barra de acciones al pie. `sticky` y no `fixed`: se queda dentro
            del contenido —sin taparse con el menú lateral— y sigue visible
            sin desplazarse hasta el final, que es lo que pide el formato de
            pantalla completa móvil. */}
        <div className="sticky bottom-0 z-30 flex flex-wrap justify-end gap-2 border-t bg-background py-4">
          <DiscardGuard dirty={isDirty} />

          {mode === "create" && (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              data-testid="save-and-new"
              onClick={submit(true)}
            >
              Guardar y crear otro
            </Button>
          )}

          <Button type="submit" disabled={isSubmitting} data-testid="save-order">
            Guardar
          </Button>
        </div>
      </form>
    </MainContainer>
  );
}
