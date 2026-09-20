import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  enviadas: [] as { orderId: string; line: Record<string, unknown> }[],
  respuesta: undefined as undefined | { error: string },
}));

vi.mock("@/actions/orders", () => ({
  addOrderLine: async (input: { orderId: string; line: Record<string, unknown> }) => {
    estado.enviadas.push(input);
    return estado.respuesta;
  },
}));

const { PrintCostOrderAction } = await import("@/tools/print-cost-3d/ui/order-action");
const { configSchema } = await import("@/tools/print-cost-3d/schema");

const ORDER = "55555555-5555-4555-8555-555555555555";
const defaults = configSchema.parse({});

beforeEach(() => {
  estado.enviadas = [];
  estado.respuesta = undefined;
});
afterEach(cleanup);

async function openAndCalculate() {
  render(<PrintCostOrderAction orderId={ORDER} config={defaults} currency="BOB" />);
  await userEvent.click(screen.getByRole("button", { name: "Calcular impresión 3D" }));

  // El caso de referencia: 143 g, 11 h (660 min), 6 unidades, 2 colores → costo
  // 10,59, unitario 26 y por mayor 21 con el redondeo a la unidad.
  await userEvent.type(screen.getByLabelText("Filamento de la placa (g)"), "143");
  await userEvent.type(screen.getByLabelText("Horas"), "11");
  for (const [label, value] of [
    ["Unidades por placa", "6"],
    ["Colores", "2"],
  ] as const) {
    const field = screen.getByLabelText(label);
    await userEvent.clear(field);
    await userEvent.type(field, value);
  }
}

const confirm = () => userEvent.click(screen.getByRole("button", { name: "Añadir al pedido" }));

/** KAM-27 · spec `print-cost-3d` → *Desde un pedido, el resultado se vuelve una línea*. */
describe("PrintCostOrderAction", () => {
  it("cerrado, solo ofrece el botón", () => {
    render(<PrintCostOrderAction orderId={ORDER} config={defaults} currency="BOB" />);
    expect(screen.getByRole("button", { name: "Calcular impresión 3D" })).toBeInTheDocument();
    expect(screen.queryByTestId("print-cost-dialog")).not.toBeInTheDocument();
  });

  it("sin cálculo no se puede añadir nada", async () => {
    render(<PrintCostOrderAction orderId={ORDER} config={defaults} currency="BOB" />);
    await userEvent.click(screen.getByRole("button", { name: "Calcular impresión 3D" }));

    expect(screen.getByRole("button", { name: "Añadir al pedido" })).toBeDisabled();
    expect(screen.queryByTestId("print-cost-line")).not.toBeInTheDocument();
  });

  it("añade una línea libre con el precio unitario, la cantidad de la placa y la descripción", async () => {
    await openAndCalculate();

    const line = within(screen.getByTestId("print-cost-line"));
    expect(line.getByLabelText("Cantidad")).toHaveValue("6");
    expect(line.getByLabelText("Precio (BOB)")).toHaveValue("26.00");

    const description = line.getByLabelText("Descripción");
    await userEvent.clear(description);
    await userEvent.type(description, "Llavero calavera");
    await confirm();

    expect(estado.enviadas).toHaveLength(1);
    expect(estado.enviadas[0].orderId).toBe(ORDER);
    expect(estado.enviadas[0].line).toMatchObject({
      description: "Llavero calavera",
      quantity: 6,
      unitPrice: 26,
    });
    expect(estado.enviadas[0].line.id).toMatch(/^[0-9a-f-]{36}$/);
    // Se cierra al terminar bien.
    expect(screen.queryByTestId("print-cost-dialog")).not.toBeInTheDocument();
  });

  it("la línea no lleva ni el costo ni el margen: solo lo que una línea lleva", async () => {
    await openAndCalculate();
    await confirm();

    expect(Object.keys(estado.enviadas[0].line).sort()).toEqual([
      "description",
      "id",
      "quantity",
      "unitPrice",
    ]);
  });

  it("se puede elegir el precio por mayor", async () => {
    await openAndCalculate();
    await userEvent.click(screen.getByRole("radio", { name: /Precio por mayor/ }));

    expect(screen.getByLabelText("Precio (BOB)")).toHaveValue("21.00");
    await confirm();
    expect(estado.enviadas[0].line.unitPrice).toBe(21);
  });

  it("el precio ajustado a mano es el que se guarda, con coma decimal incluida", async () => {
    await openAndCalculate();
    const price = screen.getByLabelText("Precio (BOB)");
    await userEvent.clear(price);
    await userEvent.type(price, "25,5");
    const quantity = screen.getByLabelText("Cantidad");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "12");
    await confirm();

    expect(estado.enviadas[0].line).toMatchObject({ quantity: 12, unitPrice: 25.5 });
  });

  it("el ajuste a mano sobrevive a un cambio en el cálculo; cambiar de precio sugerido lo descarta", async () => {
    await openAndCalculate();
    const price = screen.getByLabelText("Precio (BOB)");
    await userEvent.clear(price);
    await userEvent.type(price, "30");

    await userEvent.type(screen.getByLabelText("Armados por unidad"), "1");
    expect(price).toHaveValue("30");

    await userEvent.click(screen.getByRole("radio", { name: /Precio por mayor/ }));
    expect(price).not.toHaveValue("30");
  });

  it("si el núcleo rechaza —pedido archivado mientras calculaba— lo muestra y no cierra", async () => {
    estado.respuesta = { error: "Este pedido está archivado: desarchívalo antes de editarlo." };
    await openAndCalculate();
    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(/archivado/);
    expect(screen.getByTestId("print-cost-dialog")).toBeInTheDocument();
  });

  it("cada apertura empieza vacía: cancelar no deja nada para la próxima", async () => {
    await openAndCalculate();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(estado.enviadas).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Calcular impresión 3D" }));
    expect(screen.getByLabelText("Filamento de la placa (g)")).toHaveValue("");
  });

  it("con parámetros inservibles no calcula: manda a revisarlos", async () => {
    render(
      <PrintCostOrderAction
        orderId={ORDER}
        config={{ marginCurve: [{ cost: 10, margin: 0.5 }] }}
        currency="BOB"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Calcular impresión 3D" }));

    expect(screen.getByTestId("print-cost-invalid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Añadir al pedido" })).not.toBeInTheDocument();
  });
});
