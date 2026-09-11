import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contact, Role } from "@/types";

import type { RecordHistory } from "@/services/activity/record-history";

import { ContactsScreen } from "./contacts-screen";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

const relatedTasksFor = vi.fn(async () => [
  {
    id: "t1",
    title: "Revisar filamento",
    statusName: "En curso",
    dueAt: null,
    closedAt: null,
  },
]);

vi.mock("@/actions/tasks", () => ({
  relatedTasksFor: (...args: unknown[]) => relatedTasksFor(...(args as [])),
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
  history: RecordHistory | null = null,
) {
  return render(
    <ContactsScreen
      contacts={contacts}
      roleFilter="all"
      search=""
      includeArchived={false}
      timezone="America/La_Paz"
      history={history}
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

/**
 * KAM-21 · El bloque *Tareas relacionadas* en el panel derecho de V13.
 *
 * Escenarios del delta spec `catalog-directory`, requisito "Pantalla de
 * contactos (V13)": «Tareas relacionadas en el panel», «El bloque sigue al
 * contacto elegido».
 */
describe("tareas relacionadas del contacto", () => {
  const andina = contact({ name: "Distribuidora Andina" });
  const ana = contact({ name: "Ana Quispe", isCustomer: true });

  // «Tareas relacionadas en el panel»
  it("muestra las tareas que apuntan al contacto elegido", async () => {
    renderScreen([andina], "owner", andina.id);

    expect(await screen.findByText("Revisar filamento")).toBeInTheDocument();
    expect(relatedTasksFor).toHaveBeenCalledWith("contact", andina.id);
  });

  // «El bloque sigue al contacto elegido»
  it("al cambiar de contacto pregunta por el nuevo, sin abandonar la página", async () => {
    relatedTasksFor.mockClear();
    renderScreen([andina, ana], "owner", andina.id);

    await screen.findByText("Revisar filamento");
    await userEvent.click(screen.getByRole("button", { name: /Ana Quispe/ }));

    expect(relatedTasksFor).toHaveBeenLastCalledWith("contact", ana.id);
    // La lista sigue visible: no se navegó a ninguna parte.
    expect(screen.getByTestId("contact-detail")).toBeInTheDocument();
  });
});

/**
 * KAM-22 · V13 estrena historial.
 *
 * Escenarios de `activity-screen` § Toda pantalla de detalle con historial lo
 * lee de la bitácora y lleva a ella → «El contacto estrena historial», «Del
 * historial a la bitácora filtrada».
 */
describe("historial del contacto", () => {
  const HREF = "/activity?type=contacts&q=c1";

  // Scenario: El contacto estrena historial
  it("muestra los cambios del contacto abierto, leídos de la bitácora", () => {
    renderScreen([contact({ id: "c1", name: "Insumos del Sur" })], "owner", "c1", {
      activityHref: HREF,
      items: [
        {
          id: 1,
          action: "created",
          sentence: "Diego registró el contacto",
          occurredAt: "2026-09-07T14:00:00Z",
          detail: { kind: "rows", rows: [] },
        },
      ],
    });

    const entradas = screen.getAllByTestId("history-entry");
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toHaveTextContent("Diego registró el contacto");
  });

  // Scenario: Del historial a la bitácora filtrada
  it("lleva a la bitácora filtrada por este contacto", () => {
    renderScreen([contact({ id: "c1" })], "owner", "c1", {
      activityHref: HREF,
      items: [
        {
          id: 1,
          action: "created",
          sentence: "Diego registró el contacto",
          occurredAt: "2026-09-07T14:00:00Z",
          detail: { kind: "rows", rows: [] },
        },
      ],
    });

    expect(screen.getByTestId("activity-link")).toHaveAttribute("href", HREF);
  });

  // Al ayudante RLS le devuelve cero filas: mensaje de lista sin contenido,
  // nunca un error.
  it("sin eventos se rinde vacío, no como error", () => {
    renderScreen([contact({ id: "c1" })], "assistant", "c1", {
      activityHref: HREF,
      items: [],
    });

    expect(screen.getByTestId("empty-history")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
