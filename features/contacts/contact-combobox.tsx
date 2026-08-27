"use client";

import { PlusIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { createContactInline } from "@/actions/contacts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { matchesSearch } from "@/lib/search/normalize";
import type { Contact } from "@/types";

export type ContactComboboxRole = "supplier" | "customer" | "any";

/**
 * Buscador de contactos con creación al vuelo.
 *
 * Se estrena en V13, pero existe para los formularios de pedido (KAM-08) y de
 * compra (KAM-09): cuando lo tecleado no existe, ofrece crearlo sin abandonar
 * el formulario en curso, y deja el contacto recién creado seleccionado. El
 * filtrado en memoria usa la misma normalización que la base (`matchesSearch`).
 */
export function ContactCombobox({
  contacts,
  role = "any",
  value,
  onSelect,
  onTermChange,
  initialTerm = "",
  label = "Contacto",
}: {
  contacts: Contact[];
  /** Rol que interesa a este formulario; también el que se asigna al crear. */
  role?: ContactComboboxRole;
  value?: Contact | null;
  onSelect: (contact: Contact) => void;
  /**
   * Lo tecleado, para quien además quiera filtrar del lado del servidor. El
   * buscador filtra siempre en memoria con la misma normalización que la base.
   */
  onTermChange?: (term: string) => void;
  /** Término que traía la dirección: el campo lo muestra, sin desplegar nada. */
  initialTerm?: string;
  label?: string;
}) {
  const [term, setTerm] = useState(initialTerm);
  // Las opciones se despliegan al teclear, no al llegar con un `?q=` puesto.
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const candidates = useMemo(
    () =>
      contacts.filter((contact) => {
        if (contact.archivedAt !== null) return false;
        if (role === "supplier" && !contact.isSupplier) return false;
        if (role === "customer" && !contact.isCustomer) return false;
        return matchesSearch(contact.name, term);
      }),
    [contacts, role, term],
  );

  const typed = term.trim();
  // Solo se ofrece crear cuando no hay una coincidencia exacta de nombre.
  const exists = candidates.some(
    (contact) => contact.name.toLowerCase() === typed.toLowerCase(),
  );
  const offerCreate = typed !== "" && !exists;

  function pick(contact: Contact) {
    onSelect(contact);
    setTerm("");
    setOpen(false);
    onTermChange?.("");
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createContactInline({
        // Identificador generado en el cliente (convención nº 9).
        id: crypto.randomUUID(),
        name: typed,
        isSupplier: role !== "customer",
        isCustomer: role !== "supplier",
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }
      pick(result.contact);
    });
  }

  return (
    <div className="flex flex-col gap-2" data-testid="contact-combobox">
      <Field>
        <FieldLabel htmlFor="contact-combobox-input">{label}</FieldLabel>
        <Input
          id="contact-combobox-input"
          value={term}
          placeholder={value ? value.name : "Buscar o crear"}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
            onTermChange?.(event.target.value);
          }}
        />
      </Field>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo crear el contacto</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {open && term !== "" && (
        <ul
          data-testid="contact-options"
          className="divide-y overflow-hidden rounded-lg border text-sm"
        >
          {candidates.map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-muted"
                onClick={() => pick(contact)}
              >
                {contact.name}
              </button>
            </li>
          ))}

          {offerCreate && (
            <li className="p-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={create}
              >
                <PlusIcon data-icon="inline-start" />
                Crear «{typed}»
              </Button>
            </li>
          )}

          {candidates.length === 0 && !offerCreate && (
            <li className="px-3 py-2 text-muted-foreground">
              Sin coincidencias
            </li>
          )}
        </ul>
      )}

      {value && (
        <p data-testid="contact-selected" className="text-sm">
          Seleccionado: <Badge variant="secondary">{value.name}</Badge>
        </p>
      )}
    </div>
  );
}
