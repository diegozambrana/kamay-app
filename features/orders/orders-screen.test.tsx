import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine, Status, StatusKind } from "@/types";

import type { BoardOrder } from "./board-view";
import { useBoardStore } from "./board-store";
import { OrdersScreen } from "./orders-screen";

vi.mock("@/actions/orders", () => ({
  moveOrderToStatus: vi.fn(async () => undefined),
  reorderQueue: vi.fn(async () => undefined),
  archiveOrder: vi.fn(async () => undefined),
  unarchiveOrder: vi.fn(async () => undefined),
}));

vi.mock("@/actions/business-line-context", () => ({
  selectBusinessLine: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const SUBLI = "22222222-2222-2222-2222-222222222222";
const ALFA = "22222222-2222-2222-2222-222222222223";
const TODAY = "2026-08-26";

let counter = 0;
function status(
  name: string,
  kind: StatusKind,
  extra: { isQueue?: boolean; lineId?: string | null } = {},
): Status {
  counter += 1;
  return {
    id: `70000000-0000-0000-0000-0000000000${String(counter).padStart(2, "0")}`,
    organizationId: ORG,
    businessLineId: extra.lineId ?? SUBLI,
    flow: "order",
    name,
    kind,
    color: "zinc",
    position: counter,
    isQueue: extra.isQueue ?? false,
    archivedAt: null,
  };
}

/** El juego real de Sublimación en la semilla: seis estados más Cancelado. */
function sublimacionSet(): Status[] {
  counter = 0;
  return [
    status("Registrado", "initial"),
    status("En diseño", "in_progress"),
    status("En cola", "waiting", { isQueue: true }),
    status("Sublimando", "in_progress"),
    status("Listo para entrega", "waiting"),
    status("Entregado", "final"),
    status("Cancelado", "cancelled"),
  ];
}

/** El de Alfarería: tres más Cancelado, sin ninguna cola. */
function alfareriaSet(): Status[] {
  counter = 20;
  return [
    status("Reservado", "initial", { lineId: ALFA }),
    status("Listo para entrega", "waiting", { lineId: ALFA }),
    status("Entregado", "final", { lineId: ALFA }),
    status("Cancelado", "cancelled", { lineId: ALFA }),
  ];
}

function order(overrides: Partial<BoardOrder> & { id: string }): BoardOrder {
  return {
    code: 1,
    contactName: "María Céspedes",
    dueDate: null,
    deliveryMode: null,
    lineColor: "blue",
    statusKind: "waiting",
    total: 0,
    paid: 0,
    itemsSummary: null,
    archivedAt: null,
    statusId: "",
    queuedAt: null,
    ...overrides,
  };
}

const lines: BusinessLine[] = [
  {
    id: SUBLI,
    organizationId: ORG,
    name: "Sublimación",
    color: "blue",
    icon: null,
    isShared: false,
    position: 1,
    archivedAt: null,
  },
  {
    id: ALFA,
    organizationId: ORG,
    name: "Alfarería",
    color: "orange",
    icon: null,
    isShared: false,
    position: 2,
    archivedAt: null,
  },
];

function columnNames(): string[] {
  return screen
    .getAllByTestId("board-column")
    .map((node) => node.getAttribute("data-status-name")!);
}

function renderScreen(props: Partial<Parameters<typeof OrdersScreen>[0]> = {}) {
  const statuses = props.statuses ?? sublimacionSet();
  return render(
    <OrdersScreen
      orders={props.orders ?? []}
      statuses={statuses}
      allStatuses={props.allStatuses ?? statuses}
      lines={lines}
      activeLineId={props.activeLineId === undefined ? SUBLI : props.activeLineId}
      receivables={props.receivables ?? []}
      view={props.view ?? "board"}
      search=""
      includeArchived={false}
      today={TODAY}
    />,
  );
}

beforeEach(() => {
  useBoardStore.setState({ pending: {}, pendingQueue: {} });
});
afterEach(cleanup);

describe("OrdersScreen · columnas resueltas por línea", () => {
  it("muestra exactamente los siete estados de Sublimación, en orden", () => {
    renderScreen();

    expect(columnNames()).toEqual([
      "Registrado",
      "En diseño",
      "En cola",
      "Sublimando",
      "Listo para entrega",
      "Entregado",
      "Cancelado",
    ]);
  });

  it("con Alfarería activa no queda rastro de las columnas de Sublimación", () => {
    renderScreen({ statuses: alfareriaSet(), activeLineId: ALFA });

    const nombres = columnNames();
    expect(nombres).toEqual([
      "Reservado",
      "Listo para entrega",
      "Entregado",
      "Cancelado",
    ]);
    expect(nombres).not.toContain("En diseño");
    expect(nombres).not.toContain("Sublimando");
    expect(nombres).not.toContain("En cola");
  });

  it("una línea sin juego propio recibe el de la organización y lo pinta igual", () => {
    // `resolve_statuses` ya devolvió el juego de la organización: la pantalla
    // no distingue el origen, que es justamente lo que se quiere.
    counter = 40;
    const orgSet = [
      status("Por hacer", "initial", { lineId: null }),
      status("Hecho", "final", { lineId: null }),
    ];
    renderScreen({ statuses: orgSet });

    expect(columnNames()).toEqual(["Por hacer", "Hecho"]);
  });

  it("renombrar un estado cambia el rótulo sin tocar código", () => {
    const renombrado = sublimacionSet();
    renombrado[2] = { ...renombrado[2], name: "Esperando turno" };
    renderScreen({ statuses: renombrado });

    expect(columnNames()).toContain("Esperando turno");
    expect(columnNames()).not.toContain("En cola");
  });

  it("con la línea Todas pide elegir y no dibuja ninguna columna", () => {
    renderScreen({ activeLineId: null, statuses: [] });

    expect(screen.getByTestId("board-needs-line")).toBeInTheDocument();
    expect(screen.queryAllByTestId("board-column")).toHaveLength(0);
    // El aviso trae las líneas a mano: es la única vía en móvil.
    expect(screen.getByRole("button", { name: /Sublimación/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alfarería/ })).toBeInTheDocument();
  });
});

describe("OrdersScreen · la cola", () => {
  const statuses = sublimacionSet();
  const enCola = statuses[2];
  const sublimando = statuses[3];

  const orders: BoardOrder[] = [
    order({
      id: "a1",
      code: 1,
      statusId: enCola.id,
      queuedAt: "2026-08-24T10:00:00.000Z",
      dueDate: "2026-09-05",
    }),
    order({
      id: "a2",
      code: 2,
      statusId: enCola.id,
      queuedAt: "2026-08-25T10:00:00.000Z",
      dueDate: "2026-09-01",
    }),
    order({
      id: "a3",
      code: 3,
      statusId: enCola.id,
      queuedAt: "2026-08-26T10:00:00.000Z",
      dueDate: "2026-08-29",
    }),
    order({ id: "b1", code: 7, statusId: sublimando.id, statusKind: "in_progress" }),
  ];

  it("numera por llegada y no por fecha comprometida", () => {
    renderScreen({ statuses, orders });

    const cola = screen
      .getAllByTestId("board-column")
      .find((node) => node.getAttribute("data-is-queue") === "1")!;

    const codigos = [...cola.querySelectorAll("[data-order-code]")].map((n) =>
      n.getAttribute("data-order-code"),
    );
    // Las fechas van al revés que la llegada: ordenar por urgencia daría 3,2,1.
    expect(codigos).toEqual(["1", "2", "3"]);

    const posiciones = [...cola.querySelectorAll('[data-testid="queue-position"]')].map(
      (n) => n.textContent,
    );
    expect(posiciones).toEqual(["1", "2", "3"]);
  });

  it("las columnas que no son cola no muestran posición", () => {
    renderScreen({ statuses, orders });

    const otra = screen
      .getAllByTestId("board-column")
      .find((node) => node.getAttribute("data-status-name") === "Sublimando")!;

    expect(otra.querySelectorAll('[data-testid="queue-position"]')).toHaveLength(0);
  });

  it("un movimiento en vuelo pinta la tarjeta en la columna destino", () => {
    useBoardStore.setState({ pending: { a3: sublimando.id }, pendingQueue: {} });
    renderScreen({ statuses, orders });

    const cola = screen
      .getAllByTestId("board-column")
      .find((node) => node.getAttribute("data-is-queue") === "1")!;
    const destino = screen
      .getAllByTestId("board-column")
      .find((node) => node.getAttribute("data-status-name") === "Sublimando")!;

    expect(cola.querySelector('[data-order-code="3"]')).toBeNull();
    expect(destino.querySelector('[data-order-code="3"]')).not.toBeNull();
    // Y la cola se renumera sola: la posición se deriva del orden.
    expect(
      [...cola.querySelectorAll('[data-testid="queue-position"]')].map(
        (n) => n.textContent,
      ),
    ).toEqual(["1", "2"]);
  });
});
