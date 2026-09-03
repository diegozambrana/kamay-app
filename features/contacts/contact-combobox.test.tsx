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
    await user.click(screen.getByRole("button", { name: /Crear «Nuevo Taller»/ }));
    await user.click(screen.getByRole("button", { name: "Crear" }));

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

// ── Creación al vuelo con teléfono (KAM-08) ───────────────────────────────

describe("ContactCombobox · creación al vuelo con teléfono", () => {
  async function openCreateStep(name: string) {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Contacto"), name);
    await user.click(screen.getByRole("button", { name: new RegExp(`Crear «${name}»`) }));
    return user;
  }

  it("pide nombre y teléfono sin abandonar el formulario", async () => {
    render(<ContactCombobox contacts={[]} role="customer" onSelect={vi.fn()} />);
    await openCreateStep("Nuevo Taller");

    const step = screen.getByTestId("contact-create-step");
    expect(step).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Nuevo Taller");
    expect(screen.getByLabelText("Teléfono")).toBeInTheDocument();
    // Todavía no se guardó nada: el paso solo abre el formulario mínimo.
    expect(createContactInline).not.toHaveBeenCalled();
  });

  it("envía el teléfono que se escribió", async () => {
    render(<ContactCombobox contacts={[]} role="customer" onSelect={vi.fn()} />);
    const user = await openCreateStep("Nuevo Taller");

    await user.type(screen.getByLabelText("Teléfono"), "77712345");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    expect(createContactInline).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nuevo Taller", phone: "77712345" }),
    );
  });

  it("sin teléfono manda el vacío, que el esquema convierte en ausencia de dato", async () => {
    render(<ContactCombobox contacts={[]} role="customer" onSelect={vi.fn()} />);
    const user = await openCreateStep("Nuevo Taller");

    await user.click(screen.getByRole("button", { name: "Crear" }));

    expect(createContactInline).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nuevo Taller", phone: "" }),
    );
  });

  it("desde un buscador de clientes, el contacto nace cliente", async () => {
    render(<ContactCombobox contacts={[]} role="customer" onSelect={vi.fn()} />);
    const user = await openCreateStep("Marisol Quispe");

    await user.click(screen.getByRole("button", { name: "Crear" }));

    expect(createContactInline).toHaveBeenCalledWith(
      expect.objectContaining({ isCustomer: true, isSupplier: false }),
    );
  });

  it("«Cancelar» vuelve a la lista sin guardar nada", async () => {
    render(<ContactCombobox contacts={[]} role="customer" onSelect={vi.fn()} />);
    const user = await openCreateStep("Nuevo Taller");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByTestId("contact-create-step")).toBeNull();
    expect(createContactInline).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Crear «Nuevo Taller»/ }),
    ).toBeInTheDocument();
  });

  /**
   * Lo que motiva la creación al vuelo: no perder el pedido a medio escribir.
   * El envoltorio imita el formulario de V5 con líneas y nota ya rellenadas.
   */
  it("el formulario en curso conserva lo que ya tenía", async () => {
    function FormularioDePrueba() {
      return (
        <form>
          <label htmlFor="nota">Nota</label>
          <textarea id="nota" defaultValue="" />
          <ul>
            <li>3 × Taza personalizada</li>
            <li>1 × Taza grande</li>
          </ul>
          <ContactCombobox contacts={[]} role="customer" onSelect={vi.fn()} />
        </form>
      );
    }

    render(<FormularioDePrueba />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nota"), "Diseño por WhatsApp");
    await user.type(screen.getByLabelText("Contacto"), "Marisol");
    await user.click(screen.getByRole("button", { name: /Crear «Marisol»/ }));
    await user.type(screen.getByLabelText("Teléfono"), "77712345");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    expect(createContactInline).toHaveBeenCalled();
    expect(screen.getByLabelText("Nota")).toHaveValue("Diseño por WhatsApp");
    expect(screen.getByText("3 × Taza personalizada")).toBeInTheDocument();
    expect(screen.getByText("1 × Taza grande")).toBeInTheDocument();
  });
});
