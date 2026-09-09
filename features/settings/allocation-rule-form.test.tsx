import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BusinessLine } from "@/types";

import { AllocationRuleForm } from "./allocation-rule-form";

vi.mock("@/actions/configuration", () => ({
  updateAllocationRule: vi.fn(async () => undefined),
}));

import { updateAllocationRule } from "@/actions/configuration";

const SUB = "11111111-1111-1111-1111-111111111111";
const TRD = "22222222-2222-2222-2222-222222222222";
const ALF = "33333333-3333-3333-3333-333333333333";

function line(id: string, name: string): BusinessLine {
  return {
    id,
    organizationId: "org",
    name,
    color: "blue",
    icon: null,
    isShared: false,
    position: 1,
    archivedAt: null,
  };
}

const LINES = [line(SUB, "Sublimación"), line(TRD, "Impresión 3D"), line(ALF, "Alfarería")];

beforeEach(() => vi.mocked(updateAllocationRule).mockClear());
afterEach(cleanup);

describe("AllocationRuleForm", () => {
  // Escenario «Owner switches the allocation rule».
  it("cambiar a partes iguales guarda esa regla", async () => {
    render(<AllocationRuleForm lines={LINES} settings={{ rule: "revenue" }} />);

    await userEvent.click(screen.getByRole("radio", { name: /Partes iguales/ }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateAllocationRule).toHaveBeenCalledWith({ rule: "equal" });
  });

  it("la regla proporcional no manda porcentajes que nadie declaró", async () => {
    render(<AllocationRuleForm lines={LINES} settings={{ rule: "equal" }} />);

    await userEvent.click(
      screen.getByRole("radio", { name: /Proporcional a los ingresos/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateAllocationRule).toHaveBeenCalledWith({ rule: "revenue" });
  });

  it("los porcentajes solo aparecen con la regla manual", async () => {
    render(<AllocationRuleForm lines={LINES} settings={{ rule: "revenue" }} />);

    expect(screen.queryByLabelText("Sublimación")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /Manual/ }));

    expect(screen.getByLabelText("Sublimación")).toBeInTheDocument();
  });

  it("muestra la suma viva de los porcentajes", async () => {
    render(
      <AllocationRuleForm
        lines={LINES}
        settings={{ rule: "manual", shares: { [SUB]: 50, [TRD]: 30, [ALF]: 20 } }}
      />,
    );

    expect(screen.getByText(/Suman 100 % de 100 %/)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Alfarería"));

    expect(screen.getByText(/Suman 80 % de 100 %/)).toBeInTheDocument();
  });

  // Escenario «A line without a declared percentage».
  it("avisa de la línea sin porcentaje sin bloquear el guardado", async () => {
    render(
      <AllocationRuleForm
        lines={LINES}
        settings={{ rule: "manual", shares: { [SUB]: 50, [TRD]: 50 } }}
      />,
    );

    expect(
      screen.getByText(/La línea Alfarería no tiene porcentaje asignado/),
    ).toBeInTheDocument();

    // El aviso informa; el botón sigue disponible.
    const save = screen.getByRole("button", { name: "Guardar" });
    expect(save).toBeEnabled();

    await userEvent.click(save);

    expect(updateAllocationRule).toHaveBeenCalledWith({
      rule: "manual",
      shares: { [SUB]: 50, [TRD]: 50, [ALF]: 0 },
    });
  });

  it("con todos los porcentajes declarados no hay aviso", () => {
    render(
      <AllocationRuleForm
        lines={LINES}
        settings={{ rule: "manual", shares: { [SUB]: 50, [TRD]: 30, [ALF]: 20 } }}
      />,
    );

    expect(
      screen.queryByText(/no tiene porcentaje asignado/),
    ).not.toBeInTheDocument();
  });

  it("el error que devuelve la acción se muestra", async () => {
    vi.mocked(updateAllocationRule).mockResolvedValueOnce({
      error: "Los porcentajes suman 90 %; faltan 10 % para llegar a 100 %.",
    });

    render(
      <AllocationRuleForm
        lines={LINES}
        settings={{ rule: "manual", shares: { [SUB]: 50, [TRD]: 30, [ALF]: 10 } }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /faltan 10 % para llegar a 100 %/,
    );
  });
});
