import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LinkTarget, ResolvedTaskLink } from "@/services/tasks/task-service";

const searchLinkTargets = vi.fn<(term: string) => Promise<LinkTarget[]>>();
const linkTask =
  vi.fn<(input: unknown) => Promise<{ error: string } | undefined>>();

vi.mock("@/actions/tasks", () => ({
  searchLinkTargets: (term: string) => searchLinkTargets(term),
  linkTask: (input: unknown) => linkTask(input as never),
}));

const { LinkSearch } = await import("./link-search");

afterEach(cleanup);

const TASK = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const ASSET = "44444444-4444-4444-8444-444444444444";

function target(overrides: Partial<LinkTarget> = {}): LinkTarget {
  return {
    entityType: "order",
    entityId: ORDER,
    label: "Pedido #142",
    hint: "Ana Quispe",
    ...overrides,
  };
}

beforeEach(() => {
  searchLinkTargets.mockReset();
  linkTask.mockReset();
  linkTask.mockResolvedValue(undefined);
});

/**
 * KAM-21 · El buscador único de vínculos.
 *
 * Escenarios del delta spec `task-links-deliverables`, requisito "Un buscador
 * único resuelve los tipos vinculables": «Un término encuentra registros de
 * varios tipos», «La búsqueda ignora acentos y mayúsculas», «Un destino ya
 * vinculado no se ofrece dos veces», «Los registros archivados no se ofrecen»,
 * «Elegir vincula sin más pasos», «La persona dueña encuentra activos», «El
 * ayudante no encuentra activos»; y del delta `assets` → «El vínculo a un
 * activo se crea desde la tarea».
 *
 * Qué se ofrece a quién lo decide el servidor —el ayudante ni siquiera hace la
 * consulta de activos (D9)—, así que aquí se verifica que la pantalla rinde lo
 * que recibe y no inventa un segundo filtro.
 */
describe("buscador de vínculos", () => {
  async function buscar(term: string, existing: ResolvedTaskLink[] = []) {
    render(<LinkSearch taskId={TASK} existing={existing} onLinked={vi.fn()} />);
    await userEvent.type(
      screen.getByLabelText("Buscar para vincular"),
      term,
    );
  }

  // «Un término encuentra registros de varios tipos»
  it("mezcla los tipos en un solo listado, cada uno identificado", async () => {
    searchLinkTargets.mockResolvedValue([
      target(),
      target({ entityType: "item", entityId: ITEM, label: "Taza", hint: "Producto" }),
    ]);

    await buscar("taza");

    expect(await screen.findByText("Pedido #142")).toBeInTheDocument();
    expect(screen.getByText("Taza")).toBeInTheDocument();
    expect(screen.getByText(/^Pedido ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Ítem ·/)).toBeInTheDocument();
  });

  // «La búsqueda ignora acentos y mayúsculas»: la regla es del servidor; lo
  // que aquí se fija es que el término viaja tal como se escribió.
  it("manda el término sin transformarlo", async () => {
    searchLinkTargets.mockResolvedValue([]);

    await buscar("sublimacion");

    // El buscador espera a que se deje de teclear antes de consultar.
    await waitFor(() =>
      expect(searchLinkTargets).toHaveBeenLastCalledWith("sublimacion"),
    );
  });

  // «Un destino ya vinculado no se ofrece dos veces»
  it("descarta lo que la tarea ya tiene vinculado", async () => {
    searchLinkTargets.mockResolvedValue([target()]);

    await buscar("pedido", [
      {
        entityType: "order",
        entityId: ORDER,
        label: "Pedido #142",
        statusName: "En cola",
        archived: false,
      },
    ]);

    expect(await screen.findByTestId("no-link-results")).toBeInTheDocument();
    expect(screen.queryByText("Pedido #142")).not.toBeInTheDocument();
  });

  // «Los registros archivados no se ofrecen»: los excluye la consulta, así que
  // lo que se fija es que la pantalla no los reintroduce por su cuenta.
  it("ofrece exactamente lo que el servidor devuelve", async () => {
    searchLinkTargets.mockResolvedValue([target()]);

    await buscar("pedido");

    expect(await screen.findByTestId("link-results")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  // «Elegir vincula sin más pasos»
  it("elegir escribe el vínculo sin ningún guardado aparte", async () => {
    searchLinkTargets.mockResolvedValue([target()]);
    const onLinked = vi.fn();

    render(<LinkSearch taskId={TASK} existing={[]} onLinked={onLinked} />);
    await userEvent.type(screen.getByLabelText("Buscar para vincular"), "pedido");
    await userEvent.click(await screen.findByText("Pedido #142"));

    expect(linkTask).toHaveBeenCalledWith({
      taskId: TASK,
      entityType: "order",
      entityId: ORDER,
    });
    // No hay ningún botón de guardar que pulsar después.
    expect(screen.queryByRole("button", { name: /guardar/i })).toBeNull();
  });

  // «La persona dueña encuentra activos» y «El vínculo a un activo se crea
  // desde la tarea» (delta `assets`).
  it("un activo se ofrece como activo y se vincula como tal", async () => {
    searchLinkTargets.mockResolvedValue([
      target({
        entityType: "asset",
        entityId: ASSET,
        label: "Impresora 3D",
        hint: "Activo",
      }),
    ]);

    render(<LinkSearch taskId={TASK} existing={[]} onLinked={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Buscar para vincular"), "impres");
    await userEvent.click(await screen.findByText("Impresora 3D"));

    expect(linkTask).toHaveBeenCalledWith({
      taskId: TASK,
      entityType: "asset",
      entityId: ASSET,
    });
  });

  // «El ayudante no encuentra activos»: el servidor no los devuelve, y la
  // pantalla no los inventa.
  it("sin activos en la respuesta no aparece ninguno", async () => {
    searchLinkTargets.mockResolvedValue([target()]);

    await buscar("impres");

    expect(await screen.findByText("Pedido #142")).toBeInTheDocument();
    expect(screen.queryByText(/^Activo/)).not.toBeInTheDocument();
  });

  it("con el campo vacío no consulta nada", async () => {
    render(<LinkSearch taskId={TASK} existing={[]} onLinked={vi.fn()} />);

    expect(searchLinkTargets).not.toHaveBeenCalled();
    expect(screen.queryByTestId("link-results")).toBeNull();
  });

  it("un error del servidor se muestra y no se traga", async () => {
    searchLinkTargets.mockResolvedValue([target()]);
    linkTask.mockResolvedValue({ error: "Solo la persona dueña vincula activos." });

    render(<LinkSearch taskId={TASK} existing={[]} onLinked={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Buscar para vincular"), "pedido");
    await userEvent.click(await screen.findByText("Pedido #142"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Solo la persona dueña vincula activos.",
    );
  });
});
