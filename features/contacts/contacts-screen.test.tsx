import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contact, Role } from "@/types";

import { ContactsScreen } from "./contacts-screen";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/actions/contacts", () => ({
  createContact: vi.fn(async () => undefined),
  updateContact: vi.fn(async () => undefined),
  setContactArchived: vi.fn(async () => undefined),
}));

const ORG = "11111111-1111-1111-1111-111111111111";

function contact(overrides: Partial<Contact>): Contact {
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    name: "Distribuidora Andina",
    phone: null,
    email: null,
    address: null,
    isSupplier: true,
    isCustomer: false,
    notes: null,
    archivedAt: null,
    ...overrides,
  };
}

function renderScreen(
  contacts: Contact[],
  role: Role = "owner",
  selectedId: string | null = null,
) {
  return render(
    <ContactsScreen
      contacts={contacts}
      roleFilter="all"
      search=""
      includeArchived={false}
      selectedId={selectedId}
      role={role}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("ContactsScreen", () => {
  it("elegir un contacto llena el panel derecho sin abandonar la lista", async () => {
    const user = userEvent.setup();
    const andina = contact({});
    renderScreen([andina, contact({ name: "María Céspedes" })]);

    await user.click(screen.getByRole("button", { name: /Distribuidora Andina/ }));

    expect(screen.getByTestId("contact-detail")).toHaveTextContent("Proveedor");
    // La lista sigue ahí: no hubo navegación.
    expect(screen.getByTestId("contacts-list")).toHaveTextContent(
      "María Céspedes",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("el contacto de la dirección llega preseleccionado", () => {
    const andina = contact({ notes: "Entrega en 3 días" });
    renderScreen([andina], "owner", andina.id);

    expect(screen.getByTestId("contact-detail")).toHaveTextContent(
      "Entrega en 3 días",
    );
  });

  it("quien es proveedor y cliente se muestra con los dos roles", () => {
    renderScreen([contact({ name: "Taller Ñawi", isCustomer: true })]);

    expect(screen.getByTestId("contacts-list")).toHaveTextContent(
      "Proveedor y cliente",
    );
  });

  it("el filtro por rol viaja en la dirección", async () => {
    const user = userEvent.setup();
    renderScreen([contact({})]);

    await user.click(screen.getByRole("radio", { name: "Proveedores" }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining("role=supplier"));
  });

  it("guardar sin ningún rol se detiene antes de llegar a la base", async () => {
    const user = userEvent.setup();
    renderScreen([]);

    await user.click(screen.getByRole("button", { name: "Nuevo contacto" }));
    await user.type(screen.getByLabelText("Nombre"), "Sin rol");
    // El formulario nace con "Cliente" marcado: se desmarca para dejarlo sin rol.
    await user.click(screen.getByLabelText("Cliente"));
    await user.click(screen.getByRole("button", { name: "Crear contacto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "proveedor, cliente o ambos",
    );
  });

  it("un contacto archivado no ofrece edición, solo desarchivar", () => {
    const archivado = contact({ archivedAt: "2026-08-26T12:00:00Z" });
    renderScreen([archivado], "owner", archivado.id);

    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Desarchivar" }),
    ).toBeInTheDocument();
  });

  it("el ayudante no ve las acciones de archivado", () => {
    const andina = contact({});
    renderScreen([andina], "assistant", andina.id);

    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull();
  });
});
