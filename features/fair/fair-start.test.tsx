import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FairStart } from "./fair-start";
import type { BusinessLine, SalesChannel } from "@/types";

const lines = [
  { id: "line-alf", organizationId: "org", name: "Alfarería", color: "orange", isDefault: false, position: 1 },
  { id: "line-sub", organizationId: "org", name: "Sublimación", color: "blue", isDefault: false, position: 2 },
] as unknown as BusinessLine[];

const channels = [
  { id: "canal-feria", organizationId: "org", name: "Feria", position: 1 },
  { id: "canal-tienda", organizationId: "org", name: "Tienda", position: 2 },
] as unknown as SalesChannel[];

afterEach(cleanup);

describe("FairStart", () => {
  // Escenario: Canal preseleccionado
  it("preselecciona el primer canal por posición", async () => {
    const onStart = vi.fn();
    render(
      <FairStart
        lines={lines}
        channels={channels}
        needsLine={false}
        offlineWithoutSnapshot={false}
        onStart={onStart}
      />,
    );

    await userEvent.click(screen.getByTestId("fair-start"));

    expect(onStart).toHaveBeenCalledWith("line-alf", "canal-feria");
  });

  // Escenario: «Todas» exige elegir línea
  it("pide elegir línea cuando la activa es «Todas»", () => {
    render(
      <FairStart
        lines={lines}
        channels={channels}
        needsLine
        offlineWithoutSnapshot={false}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByTestId("fair-line")).toBeInTheDocument();
  });

  // Escenario: Línea activa preseleccionada
  it("no pregunta la línea cuando ya hay una activa", () => {
    render(
      <FairStart
        lines={lines}
        channels={channels}
        needsLine={false}
        offlineWithoutSnapshot={false}
        onStart={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("fair-line")).not.toBeInTheDocument();
  });

  // Escenario: Sin red y sin captura previa
  it("sin red y sin captura explica qué hacer, no muestra cuadrícula vacía", () => {
    render(
      <FairStart
        lines={lines}
        channels={channels}
        needsLine={false}
        offlineWithoutSnapshot
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByTestId("fair-needs-network")).toHaveTextContent(/una vez con conexión/i);
    expect(screen.queryByTestId("fair-start")).not.toBeInTheDocument();
  });

  it("sin canales configurados no bloquea la apertura", async () => {
    const onStart = vi.fn();
    render(
      <FairStart
        lines={lines}
        channels={[]}
        needsLine={false}
        offlineWithoutSnapshot={false}
        onStart={onStart}
      />,
    );

    await userEvent.click(screen.getByTestId("fair-start"));

    expect(onStart).toHaveBeenCalledWith("line-alf", null);
  });

  // La salida tiene que estar también aquí: sin ella, quien entra a una
  // organización sin líneas queda atrapado en el modo feria.
  it("ofrece la salida en el paso de inicio", () => {
    render(
      <FairStart
        lines={lines}
        channels={channels}
        needsLine
        offlineWithoutSnapshot={false}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByTestId("fair-exit")).toHaveAttribute("href", "/quick");
  });

  it("ofrece la salida también sin red y sin captura previa", () => {
    render(
      <FairStart
        lines={lines}
        channels={channels}
        needsLine={false}
        offlineWithoutSnapshot
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByTestId("fair-exit")).toHaveAttribute("href", "/quick");
  });

  it("explica qué falta cuando la organización no tiene líneas", () => {
    render(
      <FairStart
        lines={[]}
        channels={channels}
        needsLine
        offlineWithoutSnapshot={false}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByTestId("fair-no-lines")).toBeInTheDocument();
  });

  it("no deja empezar sin línea cuando hace falta elegirla", () => {
    render(
      <FairStart
        lines={[]}
        channels={channels}
        needsLine
        offlineWithoutSnapshot={false}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByTestId("fair-start")).toBeDisabled();
  });
});

// `fair-all-lines` · Escenario «Con la bandera, la línea de la feria recibe
// los compartidos», en el paso de inicio.
describe("FairStart · todas las líneas", () => {
  it("con la bandera, la línea se pide como la de los productos compartidos", () => {
    render(
      <FairStart
        lines={lines}
        channels={channels}
        needsLine
        allLines
        offlineWithoutSnapshot={false}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText("Línea para los productos compartidos")).toBeInTheDocument();
    expect(screen.getByTestId("fair-all-lines-help")).toHaveTextContent(
      "Cada producto se registra en su propia línea",
    );
    expect(screen.queryByText("Línea de negocio")).toBeNull();
  });

  it("con la bandera y la línea ya activa, lo explica sin pedirla", () => {
    render(
      <FairStart
        lines={lines}
        channels={channels}
        needsLine={false}
        allLines
        offlineWithoutSnapshot={false}
        onStart={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("fair-line")).toBeNull();
    expect(screen.getByTestId("fair-all-lines-help")).toHaveTextContent(
      "los compartidos, en la línea activa",
    );
  });

  it("sin la bandera, igual que siempre", () => {
    render(
      <FairStart
        lines={lines}
        channels={channels}
        needsLine
        offlineWithoutSnapshot={false}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText("Línea de negocio")).toBeInTheDocument();
    expect(screen.queryByTestId("fair-all-lines-help")).toBeNull();
  });
});
