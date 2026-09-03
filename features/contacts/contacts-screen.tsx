"use client";

import { PlusIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { setContactArchived } from "@/actions/contacts";
import { MainContainer } from "@/components/layout/main-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePendingToggle } from "@/hooks/use-pending-toggle";
import { cn } from "@/lib/utils";
import {
  CONTACT_ROLE_FILTERS,
  type Contact,
  type ContactRoleFilter,
  type Role,
} from "@/types";

import { ContactCombobox } from "./contact-combobox";
import { ContactFormDialog } from "./contact-form-dialog";

const ROLE_FILTER_LABELS: Record<ContactRoleFilter, string> = {
  all: "Todos",
  supplier: "Proveedores",
  customer: "Clientes",
};

function roleSummary(contact: Contact): string {
  if (contact.isSupplier && contact.isCustomer) return "Proveedor y cliente";
  return contact.isSupplier ? "Proveedor" : "Cliente";
}

/**
 * V13 · Contactos: dos paneles. La lista a la izquierda, el detalle a la
 * derecha. Elegir un contacto solo cambia el panel derecho —es estado de
 * interfaz, no navegación— para que la lista no se recargue en cada clic; la
 * dirección sí acepta `?id=` para los enlaces entrantes.
 */
export function ContactsScreen({
  contacts,
  roleFilter,
  search,
  includeArchived,
  selectedId,
  role,
}: {
  contacts: Contact[];
  roleFilter: ContactRoleFilter;
  search: string;
  includeArchived: boolean;
  selectedId: string | null;
  role: Role;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(selectedId);
  const [showArchived, setShowArchived] = usePendingToggle(includeArchived);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isOwner = role === "owner";
  const current = contacts.find((contact) => contact.id === selected) ?? null;

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/contacts?${next.toString()}`);
  }

  function archive(contact: Contact, archived: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setContactArchived({ id: contact.id, archived });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <MainContainer
      title="Contactos"
      description="Proveedores y clientes del negocio."
    >
      <div className="flex flex-col gap-4">

      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo completar la acción</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
        {/* Panel izquierdo: lista buscable */}
        <div className="flex flex-col gap-3">
          {/* El mismo buscador que usarán los formularios de pedido y de
              compra: busca, y si el nombre no existe lo crea sin salir de
              aquí. Lo tecleado viaja además a la dirección para que el
              servidor filtre la lista de abajo. */}
          <ContactCombobox
            contacts={contacts}
            label="Buscar o crear"
            initialTerm={search}
            onTermChange={(term) => navigate({ q: term })}
            onSelect={(contact) => {
              setSelected(contact.id);
              setCreating(false);
              setEditing(false);
            }}
          />

          <ToggleGroup
            type="single"
            variant="outline"
            value={roleFilter}
            // Radix emite "" al deseleccionar: siempre rige un filtro.
            onValueChange={(value) => value && navigate({ role: value })}
            aria-label="Rol"
            className="w-fit"
          >
            {CONTACT_ROLE_FILTERS.map((candidate) => (
              <ToggleGroupItem key={candidate} value={candidate}>
                {ROLE_FILTER_LABELS[candidate]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Field orientation="horizontal" className="w-fit">
            <Checkbox
              id="contacts-archived"
              data-testid="contacts-archived"
              checked={showArchived}
              onCheckedChange={(checked) => {
                setShowArchived(checked === true);
                navigate({ archived: checked === true ? "1" : null });
              }}
            />
            <FieldLabel htmlFor="contacts-archived">Ver archivados</FieldLabel>
          </Field>

          <Button
            className="w-fit"
            onClick={() => {
              setCreating(true);
              setSelected(null);
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Nuevo contacto
          </Button>

          <Separator />

          {contacts.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>Sin contactos</EmptyTitle>
                <EmptyDescription>
                  No hay contactos que coincidan con los filtros.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul
              data-testid="contacts-list"
              className="divide-y overflow-hidden rounded-lg border"
            >
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    data-testid="contact-row"
                    data-archived={contact.archivedAt !== null}
                    onClick={() => {
                      setSelected(contact.id);
                      setCreating(false);
                      setEditing(false);
                    }}
                    className={cn(
                      "flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted",
                      selected === contact.id && "bg-muted",
                      contact.archivedAt !== null && "text-muted-foreground",
                    )}
                  >
                    <span className="font-medium">{contact.name}</span>
                    <Badge variant="outline">{roleSummary(contact)}</Badge>
                    {contact.archivedAt !== null && (
                      <Badge variant="secondary">Archivado</Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Panel derecho: detalle */}
        <div data-testid="contact-detail">
          {!current ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>Ningún contacto elegido</EmptyTitle>
                <EmptyDescription>
                  Elige un contacto de la lista para ver sus datos.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : current.archivedAt !== null ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>{current.name} está archivado</EmptyTitle>
                <EmptyDescription>
                  Para editarlo hay que desarchivarlo primero.
                </EmptyDescription>
              </EmptyHeader>
              {isOwner && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => archive(current, false)}
                >
                  Desarchivar
                </Button>
              )}
            </Empty>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{current.name}</CardTitle>
                <CardDescription>{roleSummary(current)}</CardDescription>
                <CardAction>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setEditing(true)}>
                      Editar
                    </Button>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => archive(current, true)}
                      >
                        Archivar
                      </Button>
                    )}
                  </div>
                </CardAction>
              </CardHeader>

              <CardContent>
                <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Teléfono</dt>
                    <dd>{current.phone ?? "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Correo</dt>
                    <dd>{current.email ?? "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <dt className="text-muted-foreground">Dirección</dt>
                    <dd>{current.address ?? "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <dt className="text-muted-foreground">Notas</dt>
                    <dd>{current.notes ?? "—"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ContactFormDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={setSelected}
      />
      {current && (
        <ContactFormDialog
          key={current.id}
          open={editing}
          onOpenChange={setEditing}
          contact={current}
        />
      )}
      </div>
    </MainContainer>
  );
}
