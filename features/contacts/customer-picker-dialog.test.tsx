import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import type { Contact } from "@/types";

const createContactInline = vi.hoisted(() => vi.fn());

vi.mock("@/actions/contacts", () => ({ createContactInline }));

const { CustomerPickerDialog } = await import("./customer-picker-dialog");

afterEach(cleanup);
// Con llaves: una función devuelta por `beforeEach` se ejecuta como limpieza,
// y `mockReset()` devuelve el propio mock.
beforeEach(() => {
  createContactInline.mockReset();
});

function contact(name: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id: `c-${name}`,
    organizationId: "org",
    name,
    phone: null,
    email: null,
    address: null,
    notes: null,
    isSupplier: false,
    isCustomer: true,
    archivedAt: null,
    ...overrides,
  } as Contact;
}

const SAN_ANDRES = contact("Colegio San Andrés", { phone: "77700001" });
const CONTACTS = [
  SAN_ANDRES,
  contact("Marisol Quispe"),
  contact("Imprenta Sur", { isCustomer: false, isSupplier: true }),
  contact("Cliente archivado", { archivedAt: "2026-01-01T00:00:00Z" }),
];

function Harness({
  initial = null,
  onSelect = vi.fn(),
  onOuterSubmit = vi.fn(),
}: {
  initial?: Contact | null;
  onSelect?: (contact: Contact) => void;
  onOuterSubmit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Contact | null>(initial);
  return (
    // Como en el pedido: el diálogo vive dentro de otro formulario.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onOuterSubmit();
      }}
    >
      <Button type="button" onClick={() => setOpen(true)}>
        Abrir
      </Button>
      <output data-testid="value">{value?.name ?? ""}</output>
      <CustomerPickerDialog
        open={open}
        onOpenChange={setOpen}
        contacts={CONTACTS}
        value={value}
        onSelect={(chosen) => {
          setValue(chosen);
          onSelect(chosen);
        }}
      />
    </form>
  );
}

async function openDialog(user = userEvent.setup()) {
  await user.click(screen.getByRole("button", { name: "Abrir" }));
  const dialog = await screen.findByRole("dialog", { name: "Seleccionar cliente" });
  return { dialog, user };
}

const filterOf = (dialog: HTMLElement) =>
  within(dialog).getByRole("combobox", { name: "Buscar un cliente" });

async function goToCreate(term?: string) {
  const { dialog, user } = await openDialog();
  if (term) {
    await user.type(filterOf(dialog), term);
    await user.click(within(dialog).getByRole("button", { name: `Registrar «${term}»` }));
  } else {
    await user.click(within(dialog).getByRole("button", { name: "Registrar nuevo cliente" }));
  }
  const form = await screen.findByRole("dialog", { name: "Registrar cliente" });
  return { form, user };
}

describe("CustomerPickerDialog · lista", () => {
  it("Seleccionar deshabilitado sin elección", async () => {
    render(<Harness />);
    const { dialog } = await openDialog();

    expect(
      within(dialog).getByRole("button", { name: "Seleccionar cliente" }),
    ).toBeDisabled();
  });

  it("Elegir un cliente de la lista lo asigna y cierra", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const { dialog, user } = await openDialog();

    await user.type(filterOf(dialog), "colegio");
    await user.click(within(dialog).getByRole("option", { name: /Colegio San Andrés/ }));
    await user.click(within(dialog).getByRole("button", { name: "Seleccionar cliente" }));

    expect(onSelect).toHaveBeenCalledWith(SAN_ANDRES);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("El filtro ignora acentos y mayúsculas", async () => {
    render(<Harness />);
    const { dialog, user } = await openDialog();

    await user.type(filterOf(dialog), "ANDRES");

    expect(within(dialog).getAllByRole("option")).toHaveLength(1);
    expect(
      within(dialog).getByRole("option", { name: /Colegio San Andrés/ }),
    ).toBeInTheDocument();
  });

  it("Solo se listan clientes vigentes", async () => {
    render(<Harness />);
    const { dialog } = await openDialog();

    const names = within(dialog)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(names).toEqual(["Colegio San Andrés77700001", "Marisol Quispe"]);
  });

  it("Cancelar no cambia el cliente", async () => {
    const onSelect = vi.fn();
    render(<Harness initial={SAN_ANDRES} onSelect={onSelect} />);
    const { dialog, user } = await openDialog();

    await user.click(within(dialog).getByRole("option", { name: /Marisol Quispe/ }));
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId("value")).toHaveTextContent("Colegio San Andrés");
  });

  it("Cambiar muestra el cliente actual marcado", async () => {
    render(<Harness initial={SAN_ANDRES} />);
    const { dialog } = await openDialog();

    expect(
      within(dialog).getByRole("option", { name: /Colegio San Andrés/ }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(dialog).getByRole("button", { name: "Seleccionar cliente" }),
    ).toBeEnabled();
  });

  it("Sin coincidencias se ofrece registrar lo buscado", async () => {
    render(<Harness />);
    const { dialog, user } = await openDialog();

    await user.type(filterOf(dialog), "Florería Luna");

    expect(within(dialog).queryAllByRole("option")).toHaveLength(0);
    expect(
      within(dialog).getByRole("button", { name: "Registrar «Florería Luna»" }),
    ).toBeInTheDocument();
    // La opción general sigue ahí.
    expect(
      within(dialog).getByRole("button", { name: "Registrar nuevo cliente" }),
    ).toBeInTheDocument();
  });
});

describe("CustomerPickerDialog · registro", () => {
  it("Registrar lo buscado prellena el nombre", async () => {
    render(<Harness />);
    const { form } = await goToCreate("Florería Luna");

    expect(within(form).getByLabelText("Nombre")).toHaveValue("Florería Luna");
    expect(within(form).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(
      within(form).getByRole("button", { name: "Crear y seleccionar" }),
    ).toBeInTheDocument();
  });

  it("Registrar sin buscar primero deja el nombre vacío", async () => {
    render(<Harness />);
    const { form } = await goToCreate();

    expect(within(form).getByLabelText("Nombre")).toHaveValue("");
  });

  it("Nombre obligatorio al registrar: no envía nada y señala el nombre", async () => {
    render(<Harness />);
    const { form, user } = await goToCreate();

    await user.click(within(form).getByRole("button", { name: "Crear y seleccionar" }));

    expect(createContactInline).not.toHaveBeenCalled();
    expect(within(form).getByRole("alert")).toHaveTextContent(
      "El nombre no puede quedar vacío",
    );
    expect(within(form).getByLabelText("Nombre")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("dialog", { name: "Registrar cliente" })).toBeInTheDocument();
  });

  it("Cancelar el registro vuelve a la lista con el filtro", async () => {
    render(<Harness />);
    const { form, user } = await goToCreate("Florería Luna");

    await user.click(within(form).getByRole("button", { name: "Cancelar" }));

    const dialog = await screen.findByRole("dialog", { name: "Seleccionar cliente" });
    expect(filterOf(dialog)).toHaveValue("Florería Luna");
    expect(createContactInline).not.toHaveBeenCalled();
  });

  it.each([
    ["el servidor lo rechaza", () =>
      createContactInline.mockResolvedValue({ error: "Ya existe un problema." }),
      "Ya existe un problema."],
    ["no hay conexión", () =>
      createContactInline.mockImplementation(async () => {
        throw new TypeError("Failed to fetch");
      }),
      "Revisa tu conexión"],
  ])("El registro fallido conserva lo escrito cuando %s", async (_, arrange, message) => {
    arrange();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const { form, user } = await goToCreate("Florería Luna");

    await user.type(within(form).getByLabelText("Teléfono"), "77712345");
    await user.click(within(form).getByRole("button", { name: "Crear y seleccionar" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent(message);
    expect(within(form).getByLabelText("Nombre")).toHaveValue("Florería Luna");
    expect(within(form).getByLabelText("Teléfono")).toHaveValue("77712345");
    expect(onSelect).not.toHaveBeenCalled();
    expect(within(form).getByRole("button", { name: "Crear y seleccionar" })).toBeEnabled();
  });

  it("Creación con nombre y teléfono: crea un cliente, lo selecciona y cierra", async () => {
    const created = contact("Florería Luna", { id: "nuevo", phone: "77712345" });
    createContactInline.mockResolvedValue({ contact: created });
    const onSelect = vi.fn();
    const onOuterSubmit = vi.fn();
    render(<Harness onSelect={onSelect} onOuterSubmit={onOuterSubmit} />);
    const { form, user } = await goToCreate("Florería Luna");

    await user.type(within(form).getByLabelText("Teléfono"), "77712345");
    await user.type(within(form).getByLabelText("Correo"), "luna@example.com");
    await user.type(within(form).getByLabelText("Dirección"), "Av. Siempre Viva 123");
    await user.click(within(form).getByRole("button", { name: "Crear y seleccionar" }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(created));
    expect(createContactInline).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Florería Luna",
        phone: "77712345",
        email: "luna@example.com",
        address: "Av. Siempre Viva 123",
        isSupplier: false,
        isCustomer: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Registrar no envía el formulario que contiene al diálogo (design D7).
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it("Enter en el registro tampoco envía el formulario exterior", async () => {
    createContactInline.mockResolvedValue({ contact: contact("Florería Luna") });
    const onOuterSubmit = vi.fn();
    render(<Harness onOuterSubmit={onOuterSubmit} />);
    const { form, user } = await goToCreate("Florería Luna");

    await user.type(within(form).getByLabelText("Nombre"), "{Enter}");

    await waitFor(() => expect(createContactInline).toHaveBeenCalledOnce());
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });
});
