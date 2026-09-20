import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MOUNTED_ORDER_ACTIONS,
  MOUNTED_PAGES,
  ToolOrderAction,
  ToolPage,
} from "@/features/tools/tool-components";
import { TOOLS } from "@/tools/registry";

vi.mock("@/actions/orders", () => ({ addOrderLine: async () => undefined }));

afterEach(cleanup);

/** KAM-27 · design D10: el montaje `slug → componente` no se queda atrás del registro. */
describe("tool-components", () => {
  it("toda herramienta con página propia está montada, y nada más", () => {
    const withPage = TOOLS.filter((tool) => tool.hooks.includes("page")).map((tool) => tool.slug);
    expect([...MOUNTED_PAGES].sort()).toEqual(withPage.sort());
  });

  it("toda herramienta con acción en el pedido está montada, y nada más", () => {
    const withAction = TOOLS.filter((tool) => tool.hooks.includes("order-detail")).map(
      (tool) => tool.slug,
    );
    expect([...MOUNTED_ORDER_ACTIONS].sort()).toEqual(withAction.sort());
  });

  it("monta la acción del pedido de la herramienta pedida, y nada para un slug desconocido", () => {
    render(<ToolOrderAction slug="print-cost-3d" orderId="o1" config={{}} currency="BOB" />);
    expect(screen.getByTestId("order-tool-print-cost-3d")).toBeInTheDocument();
    cleanup();

    const { container } = render(
      <ToolOrderAction slug="retirada" orderId="o1" config={{}} currency="BOB" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("monta la página de la herramienta pedida", () => {
    render(<ToolPage slug="print-cost-3d" config={{}} currency="BOB" />);
    expect(screen.getByTestId("print-cost-result")).toBeInTheDocument();
  });

  it("un slug sin componente no pinta nada ni falla", () => {
    const { container } = render(<ToolPage slug="retirada" config={{}} currency="BOB" />);
    expect(container).toBeEmptyDOMElement();
  });
});
