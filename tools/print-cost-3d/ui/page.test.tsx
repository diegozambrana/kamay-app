import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { configSchema } from "@/tools/print-cost-3d/schema";
import { PrintCostPage } from "@/tools/print-cost-3d/ui/page";

afterEach(cleanup);

const defaults = configSchema.parse({});
const withExtras = configSchema.parse({ extras: [{ name: "Llavero", cost: 0.5 }] });

const result = () => within(screen.getByTestId("print-cost-result"));
const type = (label: string | RegExp, text: string) =>
  userEvent.type(screen.getByLabelText(label), text);

/**
 * KAM-27 · spec `print-cost-3d` → *La página de la calculadora*, *Entradas del
 * cálculo* y *Nada de lo calculado se guarda*.
 */
describe("PrintCostPage", () => {
  it("al montar está vacía: invita a escribir y no enseña ceros como resultado", () => {
    render(<PrintCostPage config={defaults} currency="BOB" />);

    expect(result().getByText(/Escribe los gramos y el tiempo/)).toBeInTheDocument();
    expect(screen.getByLabelText("Filamento de la placa (g)")).toHaveValue("");
    expect(screen.getByLabelText("Unidades por placa")).toHaveValue("1");
    expect(screen.getByLabelText("Colores")).toHaveValue("1");
    for (const label of ["Días", "Horas", "Minutos"]) {
      expect(screen.getByLabelText(label)).toHaveValue("");
    }
    expect(screen.queryByTestId("print-cost-minutes")).not.toBeInTheDocument();
  });

  it("calcula en vivo, sin enviar ningún formulario", async () => {
    render(<PrintCostPage config={defaults} currency="BOB" />);

    await type("Filamento de la placa (g)", "143");
    await type("Minutos", "660");
    const units = screen.getByLabelText("Unidades por placa");
    await userEvent.clear(units);
    await userEvent.type(units, "6");
    const colors = screen.getByLabelText("Colores");
    await userEvent.clear(colors);
    await userEvent.type(colors, "2");

    // El caso de referencia de la hoja: costo 10,594375.
    expect(result().getByText("Costo de producción").nextSibling).toHaveTextContent("10.59");
    expect(result().getByText("Máquina de la placa").nextSibling).toHaveTextContent("30.25");
    // 10,59 cae entre las anclas 10 → 250 % y 50 → 175 %.
    expect(result().getByText("Margen aplicado").nextSibling).toHaveTextContent("248,9 %");
    // Redondeo a la unidad por defecto.
    expect(result().getByText("Precio unitario").nextSibling).toHaveTextContent("26.00");
    expect(result().getByText(/Placa completa \(6 u\.\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("el tiempo se escribe en días, horas y minutos, y se cuenta en minutos", async () => {
    render(<PrintCostPage config={defaults} currency="BOB" />);

    await type("Días", "1");
    await type("Horas", "2");

    // 1 d 2 h = 1560 min → máquina 1560 × 2,75 ÷ 60 = 71,50.
    expect(screen.getByTestId("print-cost-minutes")).toHaveTextContent("1560 min");
    expect(result().getByText("Máquina de la placa").nextSibling).toHaveTextContent("71.50");
  });

  it("once horas o seiscientos sesenta minutos son lo mismo", async () => {
    render(<PrintCostPage config={defaults} currency="BOB" />);
    await type("Horas", "11");
    expect(result().getByText("Máquina de la placa").nextSibling).toHaveTextContent("30.25");
  });

  it("horas negativas: marca ese campo y no calcula", async () => {
    render(<PrintCostPage config={defaults} currency="BOB" />);
    await type("Horas", "-2");

    expect(screen.getByLabelText("Horas")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Minutos")).not.toHaveAttribute("aria-invalid");
    expect(result().queryByText("Precio unitario")).not.toBeInTheDocument();
  });

  it("acepta la coma decimal", async () => {
    render(<PrintCostPage config={defaults} currency="BOB" />);
    await type("Filamento de la placa (g)", "12,5");
    expect(result().getByText("Filamento de la placa").nextSibling).toHaveTextContent("2.19");
  });

  it("cero unidades: no muestra resultados y explica por qué", async () => {
    render(<PrintCostPage config={defaults} currency="BOB" />);
    await type("Filamento de la placa (g)", "100");
    const units = screen.getByLabelText("Unidades por placa");
    await userEvent.clear(units);
    await userEvent.type(units, "0");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "De la placa tiene que salir al menos una unidad",
    );
    expect(units).toHaveAttribute("aria-invalid", "true");
    expect(result().getByText(/Corrige los campos marcados/)).toBeInTheDocument();
    expect(result().queryByText("Precio unitario")).not.toBeInTheDocument();
  });

  it("gramos negativos: marca el campo y no calcula", async () => {
    render(<PrintCostPage config={defaults} currency="BOB" />);
    await type("Filamento de la placa (g)", "-5");

    expect(screen.getByLabelText("Filamento de la placa (g)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(result().queryByText("Precio unitario")).not.toBeInTheDocument();
  });

  it("ofrece un campo por cada insumo configurado, y lo suma sin margen", async () => {
    render(<PrintCostPage config={withExtras} currency="BOB" />);

    await type("Filamento de la placa (g)", "10");
    await type(/^Llavero/, "1");

    expect(result().getByText("Insumos (sin margen)").nextSibling).toHaveTextContent("0.50");
  });

  it("sin insumos configurados no hay bloque de insumos", () => {
    render(<PrintCostPage config={defaults} currency="BOB" />);
    expect(screen.queryByText("Insumos por unidad")).not.toBeInTheDocument();
  });

  it("dice con qué tarifas calcula y enlaza a cambiarlas", () => {
    render(<PrintCostPage config={{ ...defaults, filamentPricePerKg: 190 }} currency="BOB" />);

    const rates = screen.getByTestId("print-cost-rates");
    expect(rates).toHaveTextContent("190.00 BOB por kilo");
    expect(rates).toHaveTextContent("2.75 BOB por hora");
    expect(within(rates).getByRole("link", { name: "Cambiar parámetros" })).toHaveAttribute(
      "href",
      "/settings/tools",
    );
  });

  it("recién activada, sin nada guardado, calcula con los valores por defecto", async () => {
    render(<PrintCostPage config={{}} currency="BOB" />);
    expect(screen.getByTestId("print-cost-rates")).toHaveTextContent("175.00 BOB por kilo");
  });

  it("parámetros inservibles: ningún precio, y un enlace a revisarlos", () => {
    render(
      <PrintCostPage
        config={{
          marginCurve: [
            { cost: 10, margin: 2.5 },
            { cost: 12, margin: 1.5 },
          ],
        }}
        currency="BOB"
      />,
    );

    expect(screen.getByTestId("print-cost-invalid")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar parámetros" })).toHaveAttribute(
      "href",
      "/settings/tools",
    );
    expect(screen.queryByTestId("print-cost-result")).not.toBeInTheDocument();
  });

  it("salir y volver: el cálculo anterior no existe", async () => {
    const first = render(<PrintCostPage config={defaults} currency="BOB" />);
    await type("Filamento de la placa (g)", "143");
    first.unmount();

    render(<PrintCostPage config={defaults} currency="BOB" />);
    expect(screen.getByLabelText("Filamento de la placa (g)")).toHaveValue("");
    expect(result().getByText(/Escribe los gramos y el tiempo/)).toBeInTheDocument();
  });
});

/**
 * Spec → *Un cálculo no deja rastro en la base*. No hay nada que consultar
 * después de calcular porque no hay **por dónde** escribir: ni la página ni lo
 * que comparte con el diálogo importan una acción, un almacenamiento del
 * navegador o un store.
 */
describe("un cálculo no deja rastro", () => {
  it.each(["page.tsx", "calculator-form.tsx", "use-print-cost.ts"])(
    "%s no importa acciones ni persiste nada",
    (file) => {
      const source = readFileSync(join(process.cwd(), "tools/print-cost-3d/ui", file), "utf8");
      expect(source).not.toMatch(/from\s+["']@\/actions\//);
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|@\/stores\//);
    },
  );
});
