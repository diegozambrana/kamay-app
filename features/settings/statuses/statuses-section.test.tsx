import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine, Status } from "@/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/actions/statuses", () => ({
  applyOrganizationStatuses: vi.fn(async () => undefined),
  archiveStatus: vi.fn(async () => undefined),
  createOwnStatusSet: vi.fn(async () => undefined),
  createStatus: vi.fn(async () => undefined),
  reorderStatuses: vi.fn(async () => undefined),
  restoreDefaultStatuses: vi.fn(async () => undefined),
  updateStatus: vi.fn(async () => undefined),
}));

import {
  applyOrganizationStatuses,
  archiveStatus,
  createOwnStatusSet,
  createStatus,
  restoreDefaultStatuses,
  updateStatus,
} from "@/actions/statuses";

import { StatusesSection } from "./statuses-section";

const ORG = "11111111-1111-1111-1111-111111111111";
const ALFARERIA_ID = "22222222-2222-2222-2222-222222222222";

let position = 0;
function status(overrides: Partial<Status>): Status {
  position += 1;
  return {
    id: crypto.randomUUID(),
    organizationId: ORG,
    businessLineId: null,
    flow: "order",
    name: "Estado",
    kind: "waiting",
    color: "zinc",
    position,
    isQueue: false,
    archivedAt: null,
    ...overrides,
  };
}

const ALFARERIA: BusinessLine = {
  id: ALFARERIA_ID,
  organizationId: ORG,
  name: "Alfarería",
  color: "orange",
  icon: null,
  isShared: false,
  position: 2,
  archivedAt: null,
};

const REGISTRADO = status({ name: "Registrado", kind: "initial" });
const EN_COLA = status({ name: "En cola", kind: "waiting" });
const SUBLIMANDO = status({ name: "Sublimando", kind: "in_progress" });
const ENTREGADO = status({ name: "Entregado", kind: "final" });
const SET = [REGISTRADO, EN_COLA, SUBLIMANDO, ENTREGADO];

function renderSection(statuses: Status[] = SET, businessLineId: string | null = null) {
  render(
    <StatusesSection
      lines={[ALFARERIA]}
      flow="order"
      businessLineId={businessLineId}
      statuses={statuses}
    />,
  );
}

async function chooseFromRow(name: string, action: "Editar" | "Archivar") {
  await userEvent.click(screen.getByRole("button", { name: `Acciones de ${name}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("StatusesSection · editar y agregar en un diálogo", () => {
  // Spec `configurable-statuses` → «Editar un estado en un diálogo», nivel unitario.
  it("«Editar» abre el diálogo con sus valores y «Guardar cambios» lo actualiza", async () => {
    const user = userEvent.setup();
    renderSection();

    await chooseFromRow("En cola", "Editar");
    const dialog = await screen.findByRole("dialog", { name: "Editar «En cola»" });
    const name = within(dialog).getByLabelText("Nombre");
    expect(name).toHaveValue("En cola");
    expect(within(dialog).getByLabelText("Tipo")).toHaveTextContent("En espera");

    await user.clear(name);
    await user.type(name, "En cola de impresión");
    await user.click(within(dialog).getByRole("checkbox", { name: "Columna en cola" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(updateStatus).toHaveBeenCalledWith({
      id: EN_COLA.id,
      name: "En cola de impresión",
      kind: "waiting",
      color: "zinc",
      isQueue: true,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // Spec `configurable-statuses` → «El diálogo no deja un juego sin estado final».
  it("cambiar el tipo del único final deja el diálogo abierto con el aviso", async () => {
    const user = userEvent.setup();
    renderSection();

    await chooseFromRow("Entregado", "Editar");
    const dialog = await screen.findByRole("dialog", { name: "Editar «Entregado»" });
    await user.click(within(dialog).getByLabelText("Tipo"));
    await user.click(await screen.findByRole("option", { name: "En espera" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      /al menos un estado inicial y uno final/,
    );
    expect(updateStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Editar «Entregado»" })).toBeInTheDocument();
  });

  it("la marca de cola sobre un estado que no es de espera se rechaza dentro del diálogo", async () => {
    const user = userEvent.setup();
    renderSection();

    await chooseFromRow("Sublimando", "Editar");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: "Columna en cola" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(/En espera/);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("«Agregar estado» está junto al título y crea en el alcance actual", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: "Agregar estado" }));
    const dialog = await screen.findByRole("dialog", { name: "Agregar estado" });
    await user.type(within(dialog).getByLabelText("Nombre"), "Empacando");
    await user.click(within(dialog).getByRole("button", { name: "Agregar estado" }));

    expect(createStatus).toHaveBeenCalledWith({
      businessLineId: null,
      flow: "order",
      name: "Empacando",
      kind: "in_progress",
      color: "zinc",
      isQueue: false,
    });
  });
});

describe("StatusesSection · archivar", () => {
  // Spec `configurable-statuses` → «Archivar pide a dónde mover dentro de la confirmación».
  it("archivar pide a dónde mover y solo archiva al pulsar «Archivar estado»", async () => {
    const user = userEvent.setup();
    renderSection();

    await chooseFromRow("En cola", "Archivar");
    const dialog = await screen.findByRole("alertdialog", { name: "¿Archivar «En cola»?" });
    expect(archiveStatus).not.toHaveBeenCalled();

    await user.click(within(dialog).getByLabelText("Mover los registros que lo usaban a"));
    await user.click(await screen.findByRole("option", { name: "Registrado" }));
    await user.click(within(dialog).getByRole("button", { name: "Archivar estado" }));

    expect(archiveStatus).toHaveBeenCalledWith({ id: EN_COLA.id, moveToId: REGISTRADO.id });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("sin destino elegido archiva sin mover nada", async () => {
    renderSection();

    await chooseFromRow("Sublimando", "Archivar");
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archivar estado" }));

    expect(archiveStatus).toHaveBeenCalledWith({ id: SUBLIMANDO.id, moveToId: null });
  });

  it("archivar el único inicial se bloquea antes de llegar a la base", async () => {
    renderSection();

    await chooseFromRow("Registrado", "Archivar");
    const dialog = await screen.findByRole("alertdialog");

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      /al menos un estado inicial y uno final/,
    );
    expect(within(dialog).getByRole("button", { name: "Archivar estado" })).toBeDisabled();
    expect(archiveStatus).not.toHaveBeenCalled();
  });
});

describe("StatusesSection · acciones del juego", () => {
  // Spec `configurable-statuses` → «Cancelar la restauración no cambia nada».
  it("«Restaurar valores por defecto» pide confirmación y «Cancelar» no restaura", async () => {
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Restaurar valores por defecto" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "¿Restaurar los estados por defecto?",
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(restoreDefaultStatuses).not.toHaveBeenCalled();
  });

  it("confirmar la restauración la ejecuta para el alcance actual", async () => {
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Restaurar valores por defecto" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Restaurar" }),
    );

    expect(restoreDefaultStatuses).toHaveBeenCalledWith({ businessLineId: null, flow: "order" });
  });

  it("«Crear juego propio para esta línea» pide confirmación antes de crearlo", async () => {
    renderSection([], ALFARERIA_ID);

    await userEvent.click(
      screen.getByRole("button", { name: "Crear juego propio para esta línea" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "¿Crear un juego propio para Alfarería?",
    });
    expect(createOwnStatusSet).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear juego propio" }));

    expect(createOwnStatusSet).toHaveBeenCalledWith({ businessLineId: ALFARERIA_ID, flow: "order" });
  });

  it("«Crear el juego por defecto» pide confirmación antes de crearlo", async () => {
    renderSection([]);

    await userEvent.click(screen.getByRole("button", { name: "Crear el juego por defecto" }));
    const dialog = await screen.findByRole("alertdialog", { name: "¿Crear el juego por defecto?" });
    expect(restoreDefaultStatuses).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear el juego" }));

    expect(restoreDefaultStatuses).toHaveBeenCalledWith({ businessLineId: null, flow: "order" });
  });

  it("«Usar el juego de la organización» pide confirmación antes de descartar el propio", async () => {
    const own = SET.map((s) => ({ ...s, businessLineId: ALFARERIA_ID }));
    renderSection(own, ALFARERIA_ID);

    await userEvent.click(screen.getByRole("button", { name: "Usar el juego de la organización" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "¿Usar el juego de la organización en Alfarería?",
    });
    expect(applyOrganizationStatuses).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Usar el juego de la organización" }),
    );

    expect(applyOrganizationStatuses).toHaveBeenCalledWith({
      businessLineId: ALFARERIA_ID,
      flow: "order",
    });
  });
});
