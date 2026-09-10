import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedTaskLink } from "@/services/tasks/task-service";

const unlinkTask =
  vi.fn<(input: unknown) => Promise<{ error: string } | undefined>>();
const refresh = vi.fn();

vi.mock("@/actions/tasks", () => ({
  unlinkTask: (input: unknown) => unlinkTask(input as never),
  linkTask: vi.fn(async () => undefined),
  searchLinkTargets: vi.fn(async () => []),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const { TaskLinks } = await import("./task-links");

afterEach(cleanup);

const TASK = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";

function link(overrides: Partial<ResolvedTaskLink> = {}): ResolvedTaskLink {
  return {
    entityType: "order",
    entityId: ORDER,
    label: "Pedido #142",
    statusName: "En producción",
    archived: false,
    ...overrides,
  };
}

beforeEach(() => {
  unlinkTask.mockReset();
  unlinkTask.mockResolvedValue(undefined);
  refresh.mockReset();
});

/**
 * KAM-21 · La sección *Vínculos* del detalle de tarea.
 *
 * Escenarios del delta spec `task-links-deliverables`:
 * - "El vínculo refleja el estado actual del registro, nunca una copia" → «Un
 *   destino archivado sigue visible».
 * - "Los vínculos se quitan sin tocar el registro apuntado" → «Quitar el
 *   vínculo no toca el pedido», «Se puede volver a vincular».
 *
 * Que el estado mostrado sea el actual y no una copia se verifica donde se
 * resuelve —`TaskService.links`—: aquí lo que se rinde es lo que llega.
 */
describe("sección de vínculos", () => {
  it("muestra el estado que trae cada vínculo", () => {
    render(<TaskLinks taskId={TASK} links={[link()]} readOnly={false} />);

    expect(screen.getByText("Pedido #142")).toBeInTheDocument();
    expect(screen.getByText("En producción")).toBeInTheDocument();
  });

  // «Un destino archivado sigue visible»
  it("un destino archivado sigue listado y se señala", () => {
    render(
      <TaskLinks taskId={TASK} links={[link({ archived: true })]} readOnly={false} />,
    );

    expect(screen.getByText("Pedido #142")).toBeInTheDocument();
    expect(screen.getByTestId("link-archived")).toHaveTextContent("Archivado");
  });

  // «Quitar el vínculo no toca el pedido»
  it("quitar solo retira la relación", async () => {
    render(<TaskLinks taskId={TASK} links={[link()]} readOnly={false} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Quitar el vínculo con Pedido #142" }),
    );

    expect(unlinkTask).toHaveBeenCalledWith({
      taskId: TASK,
      entityType: "order",
      entityId: ORDER,
    });
    // Ninguna acción sobre el pedido: solo se llamó a `unlinkTask`.
    expect(unlinkTask).toHaveBeenCalledOnce();
  });

  // «Se puede volver a vincular»: tras quitar, el buscador vuelve a ofrecerlo
  // porque deja de estar en `existing`. Aquí se fija que la lista se recarga.
  it("tras quitar se recarga la lista", async () => {
    render(<TaskLinks taskId={TASK} links={[link()]} readOnly={false} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Quitar el vínculo con Pedido #142" }),
    );

    expect(refresh).toHaveBeenCalled();
  });

  it("sin vínculos lo dice, no da error", () => {
    render(<TaskLinks taskId={TASK} links={[]} readOnly={false} />);

    expect(screen.getByTestId("empty-links")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("una tarea archivada no ofrece quitar ni buscar", () => {
    render(<TaskLinks taskId={TASK} links={[link()]} readOnly />);

    expect(screen.getByText("Pedido #142")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar/ })).toBeNull();
    expect(screen.queryByLabelText("Buscar para vincular")).toBeNull();
  });

  it("cada vínculo lleva a su registro", () => {
    render(
      <TaskLinks
        taskId={TASK}
        links={[
          link(),
          link({ entityType: "item", entityId: "i1", label: "Taza", statusName: null }),
        ]}
        readOnly
      />,
    );

    expect(screen.getByRole("link", { name: /Pedido #142/ })).toHaveAttribute(
      "href",
      `/orders/${ORDER}`,
    );
    expect(screen.getByRole("link", { name: /Taza/ })).toHaveAttribute(
      "href",
      "/catalog/i1",
    );
  });
});
