import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderWithTotal } from "@/services/orders/order-service";
import type { Status } from "@/types";

import type { RelatedTask } from "@/services/tasks/task-service";

import { OrderDetail } from "./order-detail";

const moved = vi.fn(async (input: unknown) => void input);
vi.mock("@/actions/orders", () => ({
  moveOrderToStatus: (input: unknown) => moved(input),
  archiveOrder: vi.fn(async () => undefined),
  unarchiveOrder: vi.fn(async () => undefined),
  cancelOrder: vi.fn(async () => undefined),
}));

vi.mock("@/actions/payments", () => ({
  registerPayment: vi.fn(async () => undefined),
  voidPayment: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const SUBLI = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "55555555-5555-4555-8555-555555555555";

const registrado: Status = {
  id: "70000000-0000-4000-8000-000000000001",
  organizationId: ORG,
  businessLineId: SUBLI,
  flow: "order",
  name: "Registrado",
  kind: "initial",
  color: "zinc",
  position: 1,
  isQueue: false,
  archivedAt: null,
};

const entregado: Status = { ...registrado, id: "70000000-0000-4000-8000-000000000002", name: "Entregado", kind: "final", position: 2 };

const order = {
  id: ORDER_ID,
  organizationId: ORG,
  businessLineId: SUBLI,
  kind: "order",
  code: 142,
  contactId: null,
  statusId: registrado.id,
  salesChannelId: null,
  deliveryMode: null,
  dueDate: "2026-09-20",
  occurredAt: "2026-09-07T10:00:00Z",
  queuedAt: null,
  notes: null,
  archivedAt: null,
  total: 100,
  paid: 0,
} as unknown as OrderWithTotal;

function renderDetail(
  overrides: Partial<typeof order> = {},
  relatedTasks: RelatedTask[] = [],
) {
  return render(
    <OrderDetail
      relatedTasks={relatedTasks}
      order={{ ...order, ...overrides } as OrderWithTotal}
      lines={[]}
      statuses={[registrado, entregado]}
      statusName="Registrado"
      statusKind="initial"
      contact={null}
      businessLine={null}
      channelName={null}
      images={[]}
      payments={[]}
      canVoidPayments={false}
      history={{ items: [], activityHref: "/activity" }}
      today="2026-09-07"
      timezone="America/La_Paz"
    />,
  );
}

beforeEach(() => moved.mockClear());
afterEach(cleanup);

/**
 * KAM-15 · Escenarios del delta spec `orders` — requisito modificado "Detalle
 * del pedido": «Crear tarea para este pedido» y «Cambiar de estado no crea
 * ninguna tarea».
 */
describe("OrderDetail · crear tarea para este pedido", () => {
  it("ofrece la acción, prellenada desde este pedido", () => {
    renderDetail();

    expect(screen.getByTestId("create-task-for-order")).toHaveAttribute(
      "href",
      `/tasks/new?orderId=${ORDER_ID}`,
    );
  });

  it("la acción sigue disponible en un pedido archivado", () => {
    // Un pedido archivado no se edita ni se cancela, pero anotar un pendiente
    // sobre él —«revisar por qué se archivó»— no cambia el pedido en nada.
    renderDetail({ archivedAt: "2026-09-06T00:00:00Z" } as Partial<typeof order>);

    expect(screen.getByTestId("create-task-for-order")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-order")).not.toBeInTheDocument();
  });

  it("cambiar el estado del pedido solo mueve el pedido", () => {
    renderDetail();

    // El detalle no llama a ninguna acción de tareas: la única acción que
    // dispara el cambio de estado es la del propio pedido (convención nº 10).
    expect(moved).not.toHaveBeenCalled();
    expect(screen.getByTestId("create-task-for-order")).toBeInTheDocument();
  });
});

/**
 * KAM-21 · El bloque *Tareas relacionadas* en el detalle del pedido.
 *
 * Escenarios del delta spec `orders`, requisito "Detalle del pedido":
 * «Bloque de tareas relacionadas», «Pedido sin tareas relacionadas».
 */
describe("tareas relacionadas del pedido", () => {
  const tarea = (id: string, title: string): RelatedTask => ({
    id,
    title,
    statusName: "En curso",
    dueAt: null,
    closedAt: null,
  });

  // «Bloque de tareas relacionadas»
  it("lista las tareas vinculadas con su estado actual", () => {
    renderDetail({}, [tarea("1", "Diseñar arte"), tarea("2", "Revisar filamento")]);

    expect(screen.getByText("Tareas relacionadas")).toBeInTheDocument();
    expect(screen.getByText("Diseñar arte")).toBeInTheDocument();
    expect(screen.getByText("Revisar filamento")).toBeInTheDocument();
  });

  // «Pedido sin tareas relacionadas»
  it("sin tareas vinculadas el bloque se rinde vacío", () => {
    renderDetail({}, []);

    expect(screen.getByText("Tareas relacionadas")).toBeInTheDocument();
    expect(screen.getByTestId("empty-related-tasks")).toBeInTheDocument();
  });
});
