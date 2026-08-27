"use client";

import { useState, useTransition } from "react";

import { createContact, updateContact } from "@/actions/contacts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contactFormSchema, hasARole } from "@/lib/catalog/schema";
import type { Contact } from "@/types";

/**
 * Alta y edición de contacto en un diálogo. Los roles son casillas
 * controladas: la casilla de shadcn no es un `<input>` nativo, así que su
 * valor no llega por `FormData`.
 */
export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  /** Para que el panel derecho deje seleccionado lo recién creado. */
  onCreated?: (id: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [isSupplier, setIsSupplier] = useState(contact?.isSupplier ?? false);
  const [isCustomer, setIsCustomer] = useState(contact?.isCustomer ?? true);

  const missingRole = !hasARole({ isSupplier, isCustomer });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    // La misma regla que la base garantiza después, avisada antes de enviar.
    if (missingRole) {
      setError("Un contacto tiene que ser proveedor, cliente o ambos.");
      return;
    }

    const parsed = contactFormSchema.safeParse({
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      address: String(data.get("address") ?? ""),
      notes: String(data.get("notes") ?? ""),
      isSupplier,
      isCustomer,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    startTransition(async () => {
      if (contact) {
        const result = await updateContact({ ...parsed.data, id: contact.id });
        if (result?.error) {
          setError(result.error);
          return;
        }
      } else {
        // Identificador generado en el cliente (convención nº 9).
        const id = crypto.randomUUID();
        const result = await createContact({ ...parsed.data, id });
        if (result?.error) {
          setError(result.error);
          return;
        }
        onCreated?.(id);
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} data-testid="contact-form">
          <DialogHeader>
            <DialogTitle>
              {contact ? "Editar contacto" : "Nuevo contacto"}
            </DialogTitle>
            <DialogDescription>
              Proveedores y clientes del negocio.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>No se pudo guardar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FieldGroup className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contact-name">Nombre</FieldLabel>
                <Input
                  id="contact-name"
                  name="name"
                  defaultValue={contact?.name}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-phone">Teléfono</FieldLabel>
                <Input
                  id="contact-phone"
                  name="phone"
                  defaultValue={contact?.phone ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-email">Correo</FieldLabel>
                <Input
                  id="contact-email"
                  name="email"
                  defaultValue={contact?.email ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-address">Dirección</FieldLabel>
                <Input
                  id="contact-address"
                  name="address"
                  defaultValue={contact?.address ?? ""}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="contact-notes">Notas</FieldLabel>
              <Textarea
                id="contact-notes"
                name="notes"
                rows={3}
                defaultValue={contact?.notes ?? ""}
              />
            </Field>

            <FieldSet data-invalid={missingRole || undefined}>
              <FieldLegend variant="label">Rol</FieldLegend>
              <FieldDescription>
                Un contacto tiene que ser proveedor, cliente o ambos.
              </FieldDescription>
              <FieldGroup className="gap-3">
                <Field orientation="horizontal">
                  <Checkbox
                    id="contact-supplier"
                    checked={isSupplier}
                    aria-invalid={missingRole || undefined}
                    onCheckedChange={(checked) => setIsSupplier(checked === true)}
                  />
                  <FieldLabel htmlFor="contact-supplier">Proveedor</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="contact-customer"
                    checked={isCustomer}
                    aria-invalid={missingRole || undefined}
                    onCheckedChange={(checked) => setIsCustomer(checked === true)}
                  />
                  <FieldLabel htmlFor="contact-customer">Cliente</FieldLabel>
                </Field>
              </FieldGroup>
            </FieldSet>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {contact ? "Guardar cambios" : "Crear contacto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
