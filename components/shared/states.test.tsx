import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { FilteredEmptyState } from "./filtered-empty-state";
import { RouteError } from "./route-error";
import { RouteLoading } from "./route-loading";
import { BoardSkeleton, ListSkeleton } from "./skeletons";

afterEach(cleanup);

/**
 * Pruebas del juego de estados transversales (spec `view-states`). Cada
 * bloque nombra el escenario del delta que cubre.
 */

describe("EmptyState — vacío inicial", () => {
  it("rinde el mensaje y la acción de la vista", () => {
    render(
      <EmptyState
        title="Aún no hay pedidos en esta línea"
        action={<Button>Crear pedido</Button>}
      />,
    );

    const state = screen.getByTestId("empty-state");
    expect(within(state).getByText("Aún no hay pedidos en esta línea")).toBeInTheDocument();
    expect(within(state).getByRole("button", { name: "Crear pedido" })).toBeInTheDocument();
  });

  // «Empty state carries no decoration»
  it("no lleva ilustración, imagen ni icono", () => {
    render(
      <EmptyState
        title="Aún no hay contactos"
        description="Los proveedores y clientes aparecerán aquí."
        action={<Button>Crear contacto</Button>}
      />,
    );

    const state = screen.getByTestId("empty-state");
    expect(state.querySelector("img, svg, picture")).toBeNull();
    expect(state.querySelector("[data-slot='empty-icon']")).toBeNull();
  });
});

describe("FilteredEmptyState — sin resultados tras filtrar", () => {
  it("se distingue del vacío inicial y ofrece quitar filtros", async () => {
    const onClearFilters = vi.fn();
    render(<FilteredEmptyState onClearFilters={onClearFilters} />);

    const state = screen.getByTestId("filtered-empty-state");
    expect(within(state).getByText("Sin resultados")).toBeInTheDocument();

    await userEvent.click(within(state).getByRole("button", { name: "Quitar filtros" }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});

describe("FilteredEmptyState — en vistas de servidor", () => {
  it("con clearHref quita los filtros navegando, sin función", () => {
    render(<FilteredEmptyState clearHref="/activity" />);

    expect(screen.getByRole("link", { name: "Quitar filtros" })).toHaveAttribute(
      "href",
      "/activity",
    );
  });
});

describe("ErrorState — error con reintento", () => {
  // «Retry recovers without a full reload»
  it("reintentar llama al retry del segmento y no recarga la página", async () => {
    const retry = vi.fn();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(<ErrorState onRetry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(retry).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
  });

  it("se anuncia como alerta, en lenguaje humano", () => {
    render(<ErrorState onRetry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar esta sección");
  });
});

describe("RouteError — el límite de error de cada segmento", () => {
  // «No technical detail reaches the user»
  it("no pinta el mensaje, el código ni el identificador del error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(
      new Error('PGRST116: relation "orders" does not exist at OrderService.list'),
      { digest: "3141592653" },
    );

    render(<RouteError title="Pedidos" error={error} retry={vi.fn()} />);

    const main = screen.getByRole("main");
    expect(main).not.toHaveTextContent("PGRST116");
    expect(main).not.toHaveTextContent("OrderService");
    expect(main).not.toHaveTextContent("3141592653");
    expect(main).not.toHaveTextContent(/error:/i);
  });

  it("conserva el encabezado de la sección y reporta el error", () => {
    const reported = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("fallo de red");

    render(<RouteError title="Egresos" error={error} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Egresos" })).toBeInTheDocument();
    expect(reported).toHaveBeenCalledWith(
      "[kamay]",
      expect.objectContaining({ boundary: "Egresos", runtime: "browser" }),
      "Error: fallo de red",
    );
  });
});

describe("RouteLoading — el loading.tsx de cada segmento", () => {
  it("conserva el encabezado mientras carga: la pantalla no da un salto", () => {
    render(
      <RouteLoading title="Catálogo">
        <ListSkeleton />
      </RouteLoading>,
    );

    expect(screen.getByRole("heading", { name: "Catálogo" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  });

  it("los bloques del esqueleto son decorativos para el lector de pantalla", () => {
    render(<BoardSkeleton />);

    const region = screen.getByTestId("loading-skeleton");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region.querySelector("[aria-hidden] [data-slot='skeleton']")).not.toBeNull();
  });
});

// «Two different views present the same state identically»
describe("Consistencia entre vistas", () => {
  function structure(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll("[data-slot]")).map(
      (node) => node.getAttribute("data-slot") ?? "",
    );
  }

  it("dos vacíos iniciales distintos comparten estructura y solo cambian texto y destino", () => {
    const { container: orders } = render(
      <EmptyState title="Aún no hay pedidos" action={<Button>Crear pedido</Button>} />,
    );
    const ordersStructure = structure(orders);
    cleanup();

    const { container: expenses } = render(
      <EmptyState title="Aún no hay egresos" action={<Button>Registrar egreso</Button>} />,
    );

    expect(structure(expenses)).toEqual(ordersStructure);
    expect(ordersStructure).toContain("empty-title");
    expect(ordersStructure).toContain("empty-content");
  });
});
