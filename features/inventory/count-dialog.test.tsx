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
  captureAdjustment: async (values: unknown) => {
    estado.encolados.push(values);
    return estado.resultado;
  },
  captureConsumption: async () => estado.resultado,
}));

const { CountDialog } = await import("./count-dialog");

const item: Item = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId: ORG,
  businessLineId: null,
  kind: "supply",
  name: "Taza para sublimación",
  description: null,
  unitId: null,
  category: null,
  salePrice: null,
  minStock: 12,
  archivedAt: null,
};

beforeEach(() => {
  estado.encolados = [];
  estado.resultado = { status: "sent", result: undefined };
});

afterEach(cleanup);

describe("CountDialog", () => {
  // Escenario "No se pide explicación": la ausencia del campo es la
  // funcionalidad. Se comprueba que nada obligue a justificar.
  it("solo pide la cantidad contada: ningún campo de motivo bloquea el guardado", () => {
    render(<CountDialog open item={item} balance={65} onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText("Cantidad contada")).toBeRequired();
    expect(screen.getByLabelText("Nota")).not.toBeRequired();
    expect(screen.queryByLabelText(/motivo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/justificaci/i)).not.toBeInTheDocument();
  });

  // Escenario "El saldo pasa al valor contado": lo que viaja es la diferencia,
  // calculada aquí y ahora (design D6).
  it("encola la diferencia, no la cantidad contada", async () => {
    render(<CountDialog open item={item} balance={65} onOpenChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Cantidad contada"), "60");
    await userEvent.click(screen.getByRole("button", { name: "Guardar conteo" }));

    expect(estado.encolados).toHaveLength(1);
    expect(estado.encolados[0]).toMatchObject({ difference: -5, itemId: item.id });
  });

  // Escenario "Conteo por encima del saldo".
  it("conserva el signo de un conteo por encima del saldo", async () => {
    render(<CountDialog open item={item} balance={60} onOpenChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Cantidad contada"), "72");
    await userEvent.click(screen.getByRole("button", { name: "Guardar conteo" }));

    expect(estado.encolados[0]).toMatchObject({ difference: 12 });
  });

  // Escenario "Conteo que coincide con el saldo": se dice, y no se presenta
  // como un fallo. La base rechazaría un movimiento de cantidad cero.
  it("no guarda nada cuando el conteo coincide, y lo dice sin alarmar", async () => {
    const onOpenChange = vi.fn();
    render(<CountDialog open item={item} balance={60} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Cantidad contada"), "60");
    await userEvent.click(screen.getByRole("button", { name: "Guardar conteo" }));

    expect(estado.encolados).toHaveLength(0);
    expect(screen.getByTestId("count-unchanged")).toBeInTheDocument();
    expect(screen.getByText(/no hay nada que ajustar/i)).toBeInTheDocument();
    expect(screen.queryByText("No se pudo registrar")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("contar cero es una respuesta legítima", async () => {
    render(<CountDialog open item={item} balance={8} onOpenChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Cantidad contada"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Guardar conteo" }));

    expect(estado.encolados[0]).toMatchObject({ difference: -8 });
  });

  it("rechaza un conteo negativo sin llegar a encolar", async () => {
    render(<CountDialog open item={item} balance={60} onOpenChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Cantidad contada"), "-3");
    await userEvent.click(screen.getByRole("button", { name: "Guardar conteo" }));

    expect(estado.encolados).toHaveLength(0);
    expect(screen.getByText(/no puede ser negativo/i)).toBeInTheDocument();
  });

  it("muestra el saldo actual para que contar tenga referencia", () => {
    render(<CountDialog open item={item} balance={65} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/El saldo actual es 65/)).toBeInTheDocument();
  });

  // Encolado cuenta como registrado: la cola se encarga del resto.
  it("cierra el diálogo aunque el registro se quede en la cola", async () => {
    estado.resultado = { status: "queued" };
    const onOpenChange = vi.fn();
    render(<CountDialog open item={item} balance={65} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Cantidad contada"), "60");
    await userEvent.click(screen.getByRole("button", { name: "Guardar conteo" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("muestra el fallo definitivo sin cerrar", async () => {
    estado.resultado = { status: "failed", message: "No se pudo guardar." };
    const onOpenChange = vi.fn();
    render(<CountDialog open item={item} balance={65} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Cantidad contada"), "60");
    await userEvent.click(screen.getByRole("button", { name: "Guardar conteo" }));

    expect(screen.getByText("No se pudo guardar.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
