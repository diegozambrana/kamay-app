"use client";

import { useId, useState } from "react";

import { generateOrderRequest } from "@/actions/order-requests";
import { Alert, AlertTitle } from "@/components/ui/alert";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerPickerDialog } from "@/features/contacts/customer-picker-dialog";
import { orderRequestWhatsAppLink } from "@/lib/order-requests/whatsapp";
import type { BusinessLine, Contact } from "@/types";

/**
 * KAM-28 · «Generar y enviar»: crea la solicitud con el teléfono prellenado
 * y abre WhatsApp con `wa.me`, sin API ni credencial (spec `order-requests`
 * — Requirement: Generar y enviar abre WhatsApp sin API ni credencial).
 *
 * Elegir un cliente del directorio prellena nombre y teléfono y guarda
 * `contactId`, para que «Aceptar» lo preseleccione después (design D5 de
 * `public-order-intake`). Sin cliente elegido, se escriben a mano.
 */
export function GenerateRequestDialog({
  lines,
  contacts,
  organizationName,
}: {
  lines: BusinessLine[];
  contacts: Contact[];
  organizationName: string;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [businessLineId, setBusinessLineId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  function reset() {
    setContact(null);
    setBusinessLineId("");
    setName("");
    setPhone("");
    setError(null);
    setUrl(null);
  }

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) reset();
  }

  function chooseContact(picked: Contact) {
    setContact(picked);
    setName(picked.name);
    setPhone(picked.phone ?? "");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!businessLineId) {
      setError("Elige una línea.");
      return;
    }

    setPending(true);
    try {
      const result = await generateOrderRequest({
        id: crypto.randomUUID(),
        businessLineId,
        contactId: contact?.id ?? null,
        prefilledName: name,
        prefilledPhone: phone,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setUrl(result.url);
    } finally {
      setPending(false);
    }
  }

  const whatsappLink = url ? orderRequestWhatsAppLink(phone, organizationName, url) : null;

  return (
    <>
      <Button onClick={() => onOpenChange(true)}>Generar solicitud</Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="generate-request-dialog">
          {url ? (
            <>
              <DialogHeader>
                <DialogTitle>Solicitud generada</DialogTitle>
                <DialogDescription>
                  Envía este enlace a {name || "el cliente"}. No se vuelve a mostrar: al
                  cerrar este diálogo se pierde.
                </DialogDescription>
              </DialogHeader>

              <div
                role="status"
                data-testid="request-url"
                className="rounded-lg border bg-muted/40 p-3 text-sm"
              >
                <code className="block break-all text-xs">{url}</code>
              </div>

              <DialogFooter>
                {whatsappLink && (
                  <Button asChild>
                    <a href={whatsappLink} target="_blank" rel="noreferrer">
                      Enviar por WhatsApp
                    </a>
                  </Button>
                )}
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Listo
                  </Button>
                </DialogClose>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Generar solicitud de pedido</DialogTitle>
                <DialogDescription>
                  El cliente recibe un enlace de un solo uso para mandar sus datos e
                  imágenes de referencia. No elige productos ni precios.
                </DialogDescription>
              </DialogHeader>

              <form id={formId} onSubmit={onSubmit} className="space-y-4">
                <Field>
                  <FieldLabel htmlFor={`${formId}-line`}>Línea</FieldLabel>
                  <Select value={businessLineId} onValueChange={setBusinessLineId}>
                    <SelectTrigger id={`${formId}-line`}>
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
                </Field>

                <Button
                  type="button"
                  variant="outline"
                  id="pick-contact-trigger"
                  onClick={() => setPickerOpen(true)}
                >
                  {contact ? `Cliente: ${contact.name}` : "Elegir cliente del directorio"}
                </Button>

                <Field>
                  <FieldLabel htmlFor={`${formId}-name`}>Nombre</FieldLabel>
                  <Input
                    id={`${formId}-name`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={`${formId}-phone`}>Teléfono</FieldLabel>
                  <Input
                    id={`${formId}-phone`}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                  />
                </Field>

                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}
              </form>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" form={formId} disabled={pending}>
                  {pending ? "Generando…" : "Generar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CustomerPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contacts={contacts}
        value={contact}
        onSelect={chooseContact}
        returnFocusId="pick-contact-trigger"
      />
    </>
  );
}
