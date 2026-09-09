import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Item } from "@/types";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "55555555-5555-4555-8555-555555555555";

const estado = vi.hoisted(() => ({
  encolados: [] as unknown[],
  resultado: { status: "sent", result: undefined } as unknown,
}));

vi.mock("@/stores/organization-store", () => ({
  useOrganizationStore: (selector: (state: unknown) => unknown) =>
    selector({ organization: { id: ORG } }),
}));

vi.mock("@/stores/user-store", () => ({
  useUserStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { id: USER } }),
}));

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: () => ({
    isOnline: true,
    browserOnline: true,
    reportSendResult: vi.fn(),
  }),
}));

vi.mock("./sync/capture-movement", () => ({
  captureConsumption: async (values: unknown) => {
    estado.encolados.push(values);
    return estado.resultado;
  },
  captureAdjustment: async () => estado.resultado,
}));

const { ConsumptionDialog } = await import("./consumption-dialog");

function supply(id: string, name: string): Item {
  return {
    id,
    organizationId: ORG,
    businessLineId: null,
    kind: "supply",
    name,
    description: null,
    unitId: null,
    category: null,
    salePrice: null,
    minStock: 12,
    archivedAt: null,
  };
}

const taza = supply("22222222-2222-4222-8222-222222222222", "Taza para sublimación");
const papel = supply("33333333-3333-4333-8333-333333333333", "Papel de transferencia");

beforeEach(() => {
  estado.encolados = [];
  estado.resultado = { status: "sent", result: undefined };
});

afterEach(cleanup);

describe("ConsumptionDialog", () => {
  // Escenario "Consumo desde el detalle del insumo": el insumo viene puesto,
  // así que la operación son dos interacciones —cantidad y confirmar—.
  it("con el insumo puesto no pregunta cuál, y son dos interacciones", async () => {
    render(<ConsumptionDialog open item={taza} onOpenChange={vi.fn()} />);

    expect(screen.queryByLabelText("Insumo")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Cantidad"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(estado.encolados).toHaveLength(1);
    expect(estado.encolados[0]).toMatchObject({ itemId: taza.id, quantity: 5 });
  });

  // Escenario "Consumo desde la retícula de registro rápido": tres
  // interacciones —elegir insumo, cantidad, confirmar—.
  it("sin insumo puesto ofrece elegirlo entre los insumos", () => {
    render(
      <ConsumptionDialog open supplies={[taza, papel]} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByLabelText("Insumo")).toBeInTheDocument();
  });

  // Design D5: todo consumo humano nace `manual`, y la referencia al pedido
  // vive en la nota, prellenada y modificable.
  it("prellena la nota con la referencia de origen y la deja modificable", async () => {
    render(
      <ConsumptionDialog
        open
        item={taza}
        defaultNote="Pedido #1"
        onOpenChange={vi.fn()}
      />,
    );

    const nota = screen.getByLabelText("Nota");
    expect(nota).toHaveValue("Pedido #1");

    await userEvent.clear(nota);
    await userEvent.type(nota, "Feria de agosto");
    await userEvent.type(screen.getByLabelText("Cantidad"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(estado.encolados[0]).toMatchObject({ note: "Feria de agosto" });
  });

  // Escenario "Varios insumos para el mismo pedido": nada en el diálogo impide
  // repetirlo, porque el origen es `manual` y no queda atado a la línea.
  it("permite registrar un consumo tras otro desde el mismo origen", async () => {
    const { rerender } = render(
      <ConsumptionDialog open item={taza} defaultNote="Pedido #1" onOpenChange={vi.fn()} />,
    );

    await userEvent.type(screen.getByLabelText("Cantidad"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    rerender(
      <ConsumptionDialog open item={papel} defaultNote="Pedido #1" onOpenChange={vi.fn()} />,
    );

    await userEvent.type(screen.getByLabelText("Cantidad"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(estado.encolados).toHaveLength(2);
    expect(estado.encolados[1]).toMatchObject({ itemId: papel.id });
  });

  it("cada consumo nace con su propio identificador de dispositivo", async () => {
    const { rerender } = render(
      <ConsumptionDialog open item={taza} onOpenChange={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText("Cantidad"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    rerender(<ConsumptionDialog open item={papel} onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Cantidad"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    const [primero, segundo] = estado.encolados as { id: string }[];
    expect(primero.id).not.toBe(segundo.id);
  });

  it("rechaza una cantidad de cero sin llegar a encolar", async () => {
    render(<ConsumptionDialog open item={taza} onOpenChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Cantidad"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(estado.encolados).toHaveLength(0);
    expect(screen.getByText(/mayor que cero/i)).toBeInTheDocument();
  });

  // Escenario "Consumo sin red": encolado cuenta como registrado, sin error.
  it("cierra sin error cuando el registro se queda en la cola", async () => {
    estado.resultado = { status: "queued" };
    const onOpenChange = vi.fn();
    render(<ConsumptionDialog open item={taza} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Cantidad"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("No se pudo registrar")).not.toBeInTheDocument();
  });

  it("muestra el fallo definitivo sin cerrar", async () => {
    estado.resultado = { status: "failed", message: "No se pudo guardar." };
    const onOpenChange = vi.fn();
    render(<ConsumptionDialog open item={taza} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Cantidad"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

    expect(screen.getByText("No se pudo guardar.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
