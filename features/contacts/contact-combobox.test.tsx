import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contact } from "@/types";

import { ContactCombobox } from "./contact-combobox";

const CREATED: Contact = {
  id: "55555555-5555-5555-5555-555555555555",
  organizationId: "11111111-1111-1111-1111-111111111111",
  name: "Nuevo Taller",
  phone: null,
  email: null,
  address: null,
  isSupplier: true,
  isCustomer: false,
  notes: null,
  archivedAt: null,
};

vi.mock("@/actions/contacts", () => ({
  createContactInline: vi.fn(async () => ({ contact: CREATED })),
}));

import { createContactInline } from "@/actions/contacts";

function contact(overrides: Partial<Contact>): Contact {
  return { ...CREATED, id: crypto.randomUUID(), ...overrides };
}

const ANDINA = contact({
  name: "Distribuidora Andina",
  isSupplier: true,
  isCustomer: false,
});
const AMBOS = contact({ name: "Taller Ñawi", isSupplier: true, isCustomer: true });
const CLIENTA = contact({
  name: "María Céspedes",
  isSupplier: false,
  isCustomer: true,
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("ContactCombobox", () => {
  it("el filtro de proveedores incluye a quien también es cliente", async () => {
    const user = userEvent.setup();
    render(
      <ContactCombobox
        contacts={[ANDINA, AMBOS, CLIENTA]}
        role="supplier"
        onSelect={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Contacto"), "a");

    const options = screen.getByTestId("contact-options").textContent ?? "";
    expect(options).toContain("Taller Ñawi");
    expect(options).toContain("Distribuidora Andina");
    expect(options).not.toContain("María Céspedes");
  });

  it("busca ignorando acentos, igual que la base", async () => {
    const user = userEvent.setup();
    render(<ContactCombobox contacts={[AMBOS]} onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText("Contacto"), "nawi");

    expect(screen.getByTestId("contact-options")).toHaveTextContent("Taller Ñawi");
  });

  it("ofrece crear cuando lo tecleado no existe", async () => {
    const user = userEvent.setup();
    render(<ContactCombobox contacts={[ANDINA]} onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText("Contacto"), "Nuevo Taller");

    expect(
      screen.getByRole("button", { name: /Crear «Nuevo Taller»/ }),
    ).toBeInTheDocument();
  });

  it("no ofrece crear lo que ya existe con ese nombre", async () => {
    const user = userEvent.setup();
    render(<ContactCombobox contacts={[ANDINA]} onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText("Contacto"), "Distribuidora Andina");

    expect(screen.queryByRole("button", { name: /Crear/ })).toBeNull();
  });

  it("el contacto creado queda seleccionado y con el rol del buscador", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ContactCombobox contacts={[]} role="supplier" onSelect={onSelect} />,
    );

    await user.type(screen.getByLabelText("Contacto"), "Nuevo Taller");
    await user.click(screen.getByRole("button", { name: /Crear/ }));

    expect(createContactInline).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Nuevo Taller",
        isSupplier: true,
        isCustomer: false,
      }),
    );
    expect(onSelect).toHaveBeenCalledWith(CREATED);
  });

  it("los archivados no aparecen en el buscador", async () => {
    const user = userEvent.setup();
    render(
      <ContactCombobox
        contacts={[contact({ name: "Antiguo Proveedor", archivedAt: "2026-01-01" })]}
        onSelect={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Contacto"), "Antiguo");

    // No se lista, y por eso el buscador ofrece crear uno nuevo con ese nombre.
    expect(screen.getByTestId("contact-options")).not.toHaveTextContent(
      "Antiguo Proveedor",
    );
  });
});
