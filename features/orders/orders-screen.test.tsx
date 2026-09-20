import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { moveOrderToStatus } from "@/actions/orders";
import type { BusinessLine, Status, StatusKind } from "@/types";

import type { BoardOrder } from "./board-view";
import { useBoardStore } from "@/stores/board-store";
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

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/orders",
  useSearchParams: () => new URLSearchParams(searchParams),
}));

/** La dirección que ve la pantalla; cada prueba de filtros la fija. */
let searchParams = "";

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
    businessLineId: SUBLI,
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
  // Un pedido por omisión: sin ninguno, la pantalla muestra el vacío inicial
  // en lugar del tablero (KAM-23, `view-states`), y estas pruebas son sobre
  // las columnas.
  const seedOrder = order({
    id: "o-seed",
    statusId: statuses[0]?.id ?? "",
    statusKind: statuses[0]?.kind ?? "initial",
  });
  return render(
    <OrdersScreen
      orders={props.orders ?? [seedOrder]}
      statuses={statuses}
      allStatuses={props.allStatuses ?? statuses}
      lines={lines}
      activeLineId={props.activeLineId === undefined ? SUBLI : props.activeLineId}
      receivables={props.receivables ?? []}
      view={props.view ?? "board"}
      search=""
      includeArchived={false}
      today={TODAY}
      closedLimit={50}
      hasMoreClosed={props.hasMoreClosed ?? false}
      statusesByLine={props.statusesByLine}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useBoardStore.setState({ pending: {}, pendingQueue: {} });
  searchParams = "";
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

describe("OrdersScreen · estados transversales (view-states)", () => {
  // «Empty view offers its creation action»
  it("sin ningún pedido y sin filtros ofrece crear el primero, en lugar del tablero", () => {
    renderScreen({ orders: [] });

    const empty = screen.getByTestId("empty-state");
    expect(empty).toHaveTextContent("Aún no hay pedidos en Sublimación");
    expect(within(empty).getByRole("link", { name: "Crear pedido" })).toHaveAttribute(
      "href",
      "/orders/new",
    );
    expect(screen.queryAllByTestId("board-column")).toHaveLength(0);
    expect(screen.queryByTestId("filtered-empty-state")).not.toBeInTheDocument();
  });

  // «Filtering to zero results shows the filtered-empty state»
  it("con una búsqueda sin resultados ofrece quitar filtros, no crear", () => {
    searchParams = "q=zzz&view=list";
    renderScreen({ orders: [], view: "list" });

    const filtered = screen.getByTestId("filtered-empty-state");
    expect(within(filtered).getByRole("button", { name: "Quitar filtros" })).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  // «An empty organization never shows the filtered-empty state»
  it("ver archivados no es un filtro: una organización vacía sigue viendo el vacío inicial", () => {
    searchParams = "archived=1";
    renderScreen({ orders: [], activeLineId: null });

    expect(screen.getByTestId("empty-state")).toHaveTextContent("Aún no hay pedidos");
    expect(screen.queryByTestId("filtered-empty-state")).not.toBeInTheDocument();
  });
});

/** «Guardar vuelve a la lista»: el aviso del pedido recién creado. */
describe("OrdersScreen · pedido recién creado", () => {
  it("muestra el número y limpia `created` de la dirección", () => {
    searchParams = "view=list&q=tazas&created=42";
    renderScreen({ view: "list" });

    expect(screen.getByTestId("order-created-notice")).toHaveTextContent(
      "Pedido #42 guardado",
    );
    expect(router.replace).toHaveBeenCalledWith("/orders?view=list&q=tazas", {
      scroll: false,
    });
  });

  it("sin `created` no hay aviso ni reemplazo", () => {
    searchParams = "view=list";
    renderScreen({ view: "list" });

    expect(screen.queryByTestId("order-created-notice")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("los enlaces a alta y detalle llevan la vista de origen", () => {
    searchParams = "view=list&q=tazas";
    renderScreen({ view: "list" });

    expect(screen.getByTestId("new-order")).toHaveAttribute(
      "href",
      "/orders/new?from=view%3Dlist%26q%3Dtazas",
    );
    expect(screen.getByRole("link", { name: /^#/ })).toHaveAttribute(
      "href",
      "/orders/o-seed?from=view%3Dlist%26q%3Dtazas",
    );
  });
});

/**
 * Delta `orders` — «Tablero con todas las líneas agrupado por tipo de estado».
 */
describe("OrdersScreen · tablero con «Todas»", () => {
  function renderTodas(orders: BoardOrder[]) {
    const subli = sublimacionSet();
    const alfa = alfareriaSet();
    renderScreen({
      activeLineId: null,
      statuses: [],
      allStatuses: [...subli, ...alfa],
      statusesByLine: { [SUBLI]: subli, [ALFA]: alfa },
      orders,
    });
    return { subli, alfa };
  }

  function column(label: string) {
    return screen
      .getAllByTestId("board-column")
      .find((node) => node.getAttribute("data-status-name") === label)!;
  }

  it("las columnas son los cinco tipos, en orden, no los estados", () => {
    const subli = sublimacionSet();
    renderTodas([order({ id: "o1", statusId: subli[0].id, statusKind: "initial" })]);

    expect(screen.queryByTestId("board-needs-line")).not.toBeInTheDocument();
    expect(columnNames()).toEqual([
      "Por empezar",
      "En curso",
      "En espera",
      "Terminados",
      "Cancelados",
    ]);
  });

  it("muestra los pedidos de todas las líneas con el nombre de su estado", () => {
    const subli = sublimacionSet();
    const alfa = alfareriaSet();
    renderTodas([
      order({ id: "o1", code: 11, statusId: subli[1].id, statusKind: "in_progress" }),
      order({
        id: "o2",
        code: 22,
        statusId: alfa[0].id,
        statusKind: "initial",
        businessLineId: ALFA,
        lineColor: "orange",
      }),
    ]);

    const enCurso = within(column("En curso"));
    expect(enCurso.getByText("#11")).toBeInTheDocument();
    expect(enCurso.getByTestId("card-status")).toHaveTextContent("En diseño");

    const porEmpezar = within(column("Por empezar"));
    expect(porEmpezar.getByText("#22")).toBeInTheDocument();
    expect(porEmpezar.getByTestId("card-status")).toHaveTextContent("Reservado");
  });

  it("mover a un tipo lleva al primer estado de ese tipo en la línea del pedido", async () => {
    const user = userEvent.setup();
    const subli = sublimacionSet();
    renderTodas([order({ id: "o1", code: 11, statusId: subli[0].id, statusKind: "initial" })]);

    await user.click(screen.getByRole("button", { name: "Mover Pedido #11 a otra columna" }));
    await user.click(await screen.findByRole("menuitem", { name: "En curso" }));

    // «En diseño» va antes que «Sublimando» en el juego de Sublimación.
    expect(moveOrderToStatus).toHaveBeenCalledWith({ orderId: "o1", statusId: subli[1].id });
  });

  it("no ofrece un tipo que la línea del pedido no tiene, ni el propio", async () => {
    const user = userEvent.setup();
    const alfa = alfareriaSet();
    renderTodas([
      order({
        id: "o2",
        code: 22,
        statusId: alfa[0].id,
        statusKind: "initial",
        businessLineId: ALFA,
      }),
    ]);

    await user.click(screen.getByRole("button", { name: "Mover Pedido #22 a otra columna" }));
    const destinos = await screen.findAllByRole("menuitem");

    // Alfarería no tiene estado `in_progress`, y «Por empezar» es donde ya está.
    expect(destinos.map((item) => item.textContent)).toEqual([
      "En espera",
      "Terminados",
      "Cancelados",
    ]);
  });

  it("sin posición de cola: las colas no se numeran con «Todas»", () => {
    const subli = sublimacionSet();
    const enCola = subli[2];
    renderTodas([
      order({ id: "o1", statusId: enCola.id, statusKind: "waiting", queuedAt: "2026-09-01T10:00:00Z" }),
      order({ id: "o2", statusId: enCola.id, statusKind: "waiting", queuedAt: "2026-09-01T11:00:00Z" }),
    ]);

    expect(within(column("En espera")).getAllByTestId("order-card")).toHaveLength(2);
    expect(screen.queryByTestId("queue-position")).not.toBeInTheDocument();
    expect(column("En espera")).toHaveAttribute("data-is-queue", "0");
  });
});
