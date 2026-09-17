"use client";

import { UserPlusIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { createContactInline } from "@/actions/contacts";
import { SelectionList } from "@/components/shared/selection-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { quickContactSchema } from "@/lib/catalog/schema";
import type { Contact } from "@/types";

import { ContactFields } from "./contact-fields";

const OFFLINE =
  "No se pudo registrar el cliente. Revisa tu conexión e inténtalo de nuevo.";

const contactKey = (contact: Contact) => contact.id;
const contactName = (contact: Contact) => contact.name;

/**
 * Elegir el cliente de un pedido, o registrarlo sin salir del formulario
 * (design D5 de `order-form-picker-dialogs`).
 *
 * Dos vistas en el mismo diálogo: la lista filtrable de clientes vigentes y
 * el registro. El filtro se conserva al pasar de una a otra, y es el nombre
 * con el que nace el registro.
 *
 * Todo el estado vive dentro del contenido, que se desmonta al cerrar:
 * volver a abrir empieza en la lista, sin filtro y con el cliente actual
 * marcado.
 */
export function CustomerPickerDialog({
  open,
  onOpenChange,
  contacts,
  value,
  onSelect,
  returnFocusId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  /** El cliente actual del pedido, que llega marcado. */
  value: Contact | null;
  onSelect: (contact: Contact) => void;
  /**
   * El `id` del control que abre el diálogo. Elegir un cliente lo reemplaza
   * —«Seleccionar cliente» pasa a «Cambiar cliente»—, así que el elemento que
   * lo abrió ya no existe al cerrar: el foco se devuelve al que lleva ese
   * `id` ahora.
   */
  returnFocusId?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Mientras el registro viaja no se cierra: cerrarlo no lo detendría,
        // solo escondería su resultado.
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid="customer-picker-dialog"
        className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          const opener = returnFocusId && document.getElementById(returnFocusId);
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        <CustomerPickerBody
          contacts={contacts}
          value={value}
          onPendingChange={setPending}
          onCancel={() => onOpenChange(false)}
          onDone={(contact) => {
            onSelect(contact);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomerPickerBody({
  contacts,
  value,
  onPendingChange,
  onCancel,
  onDone,
}: {
  contacts: Contact[];
  value: Contact | null;
  onPendingChange: (pending: boolean) => void;
  onCancel: () => void;
  onDone: (contact: Contact) => void;
}) {
  const [view, setView] = useState<"list" | "create">("list");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string[]>(value ? [value.id] : []);

  const customers = useMemo(
    () =>
      contacts.filter(
        (contact) => contact.archivedAt === null && contact.isCustomer,
      ),
    [contacts],
  );

  if (view === "create") {
    return (
      <CustomerCreateForm
        initialName={term.trim()}
        onPendingChange={onPendingChange}
        onBack={() => setView("list")}
        onCreated={onDone}
      />
    );
  }

  function confirm() {
    const contact = customers.find((candidate) => candidate.id === selected[0]);
    // El actual puede no estar en la lista (recién creado en otra pestaña):
    // confirmarlo sin cambios lo deja como estaba.
    const chosen = contact ?? (value?.id === selected[0] ? value : null);
    if (chosen) onDone(chosen);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Seleccionar cliente</DialogTitle>
        <DialogDescription>
          Busca entre los clientes o registra uno nuevo.
        </DialogDescription>
      </DialogHeader>

      <SelectionList
        data-testid="customer-options"
        className="min-h-0 flex-1"
        items={customers}
        getKey={contactKey}
        getSearchText={contactName}
        renderItem={(contact) => (
          <span className="flex flex-col">
            <span className="truncate">{contact.name}</span>
            {contact.phone && (
              <span className="truncate text-xs text-muted-foreground">
                {contact.phone}
              </span>
            )}
          </span>
        )}
        mode="single"
        selected={selected}
        onSelectedChange={setSelected}
        label="Buscar un cliente"
        placeholder="Buscar un cliente"
        term={term}
        onTermChange={setTerm}
        empty={(current) =>
          current.trim() === "" ? (
            <p className="text-center text-muted-foreground">
              Todavía no hay clientes registrados.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-muted-foreground">
                Ningún cliente coincide con «{current.trim()}».
              </p>
              <Button
                type="button"
                size="sm"
                data-testid="customer-register-term"
                onClick={() => setView("create")}
              >
                <UserPlusIcon data-icon="inline-start" />
                Registrar «{current.trim()}»
              </Button>
            </div>
          )
        }
        footerSlot={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            data-testid="customer-register-new"
            // Sin haber buscado, el nombre nace vacío; con algo escrito en el
            // filtro, se aprovecha.
            onClick={() => setView("create")}
          >
            <UserPlusIcon data-icon="inline-start" />
            Registrar nuevo cliente
          </Button>
        }
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={selected.length === 0}
          data-testid="customer-confirm"
          onClick={confirm}
        >
          Seleccionar cliente
        </Button>
      </DialogFooter>
    </>
  );
}

function CustomerCreateForm({
  initialName,
  onPendingChange,
  onBack,
  onCreated,
}: {
  initialName: string;
  onPendingChange: (pending: boolean) => void;
  onBack: () => void;
  onCreated: (contact: Contact) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // El diálogo se monta dentro del `<form>` del pedido. El portal saca el
    // DOM de ahí, pero los eventos de React siguen el árbol de componentes:
    // sin esto, registrar un cliente guardaría el pedido (design D7).
    event.stopPropagation();

    const data = new FormData(event.currentTarget);
    const parsed = quickContactSchema.safeParse({
      // Identificador generado en el cliente (convención nº 9).
      id: crypto.randomUUID(),
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      address: String(data.get("address") ?? ""),
      isSupplier: false,
      isCustomer: true,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setNameInvalid(issue.path[0] === "name");
      setError(issue.message);
      return;
    }

    setError(null);
    setNameInvalid(false);
    onPendingChange(true);
    startTransition(async () => {
      try {
        const result = await createContactInline(parsed.data);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        onCreated(result.contact);
      } catch {
        // Sin red la Server Action lanza en vez de devolver: el alta de
        // contactos no pasa por la cola (design D9).
        setError(OFFLINE);
      } finally {
        onPendingChange(false);
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Registrar cliente</DialogTitle>
        <DialogDescription>
          Queda registrado como cliente y seleccionado en el pedido. El resto
          de los datos se completan desde Contactos.
        </DialogDescription>
      </DialogHeader>

      <form
        noValidate
        data-testid="customer-create-form"
        className="flex min-h-0 flex-col gap-4"
        onSubmit={submit}
      >
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>No se pudo registrar el cliente</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <ContactFields
            idPrefix="customer-create"
            defaultValues={{ name: initialName }}
            autoFocusName
            nameInvalid={nameInvalid}
          />
        </div>

        {/* Dentro del formulario: Enter en cualquier campo lo envía. */}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onBack}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending} data-testid="customer-create-submit">
            {pending && <Spinner data-icon="inline-start" />}
            Crear y seleccionar
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
