import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_LINES, type BusinessLine } from "@/types";

import { ReportHeader } from "./report-header";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/reports",
  useSearchParams: () => new URLSearchParams("preset=this-month&line=all"),
}));

const SUB = "11111111-1111-1111-1111-111111111111";

const LINES: BusinessLine[] = [
  {
    id: SUB,
    organizationId: "org",
    name: "Sublimación",
    color: "blue",
    icon: null,
    isShared: false,
    position: 1,
    archivedAt: null,
  },
];

beforeEach(() => push.mockClear());
afterEach(cleanup);

function renderHeader(overrides: Partial<Parameters<typeof ReportHeader>[0]> = {}) {
  return render(
    <ReportHeader
      lines={LINES}
      preset="this-month"
      from="2026-09-01"
      to="2026-09-30"
      line={ALL_LINES}
      {...overrides}
    />,
  );
}

describe("ReportHeader", () => {
  // Escenario «Cambiar el periodo recalcula todo»: el periodo va en la
  // dirección, así que cambiarlo vuelve a rendir el servidor y los cinco
  // informes se recalculan juntos. Ninguno puede quedarse en el anterior.
  it("cambiar el periodo escribe en la dirección", async () => {
    renderHeader();

    await userEvent.click(screen.getByLabelText("Periodo"));
    await userEvent.click(screen.getByRole("option", { name: "Mes anterior" }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining("preset=last-month"));
  });

  it("un atajo limpia el rango libre que hubiera quedado", async () => {
    renderHeader({ preset: "custom" });

    await userEvent.click(screen.getByLabelText("Periodo"));
    await userEvent.click(screen.getByRole("option", { name: "Este mes" }));

    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("preset=this-month");
    expect(url).not.toContain("from=");
    expect(url).not.toContain("to=");
  });

  it("el rango libre muestra sus dos fechas; los atajos no", async () => {
    const { rerender } = renderHeader();
    expect(screen.queryByLabelText("Desde")).not.toBeInTheDocument();

    rerender(
      <ReportHeader
        lines={LINES}
        preset="custom"
        from="2026-03-12"
        to="2026-04-20"
        line={ALL_LINES}
      />,
    );

    expect(screen.getByLabelText("Desde")).toHaveValue("2026-03-12");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-04-20");
  });

  // Escenario «La selección no se propaga»: el selector de V14 escribe en la
  // dirección y **no** toca la cookie de línea activa, para que cambiar de
  // línea en un informe no reordene el tablero de pedidos al volver.
  it("cambiar de línea no escribe la cookie de línea activa", async () => {
    const cookieBefore = document.cookie;
    renderHeader();

    await userEvent.click(screen.getByLabelText("Línea"));
    await userEvent.click(screen.getByRole("option", { name: "Sublimación" }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining(`line=${SUB}`));
    expect(document.cookie).toBe(cookieBefore);
  });

  it('ofrece "Todas" además de las líneas', async () => {
    renderHeader();

    await userEvent.click(screen.getByLabelText("Línea"));

    expect(screen.getByRole("option", { name: "Todas" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sublimación" })).toBeInTheDocument();
  });
});
