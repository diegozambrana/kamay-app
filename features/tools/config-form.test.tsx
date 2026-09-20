import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  guardados: [] as { slug: string; config: Record<string, unknown> }[],
  respuesta: undefined as
    | undefined
    | { error: string; issues?: { path: (string | number)[]; message: string }[] },
}));

vi.mock("@/actions/tools", () => ({
  updateToolConfig: async (slug: string, config: Record<string, unknown>) => {
    estado.guardados.push({ slug, config });
    return estado.respuesta;
  },
}));

const { ConfigForm } = await import("@/features/tools/config-form");
const { configSchema } = await import("@/tools/print-cost-3d/schema");

const SLUG = "print-cost-3d";
const defaults = configSchema.parse({}) as Record<string, unknown>;

function renderForm(config: Record<string, unknown> = defaults) {
  render(<ConfigForm slug={SLUG} config={config} />);
}

const save = () => userEvent.click(screen.getByRole("button", { name: "Guardar parámetros" }));

beforeEach(() => {
  estado.guardados = [];
  estado.respuesta = undefined;
});
afterEach(cleanup);

/** KAM-27 · spec `tenant-tools` → *Los parámetros se editan en un formulario derivado del esquema*. */
describe("ConfigForm", () => {
  it("pinta un campo por parámetro, precargado con los valores de la organización", () => {
    renderForm({ ...defaults, filamentPricePerKg: 190 });

    expect(screen.getByLabelText("Precio del filamento (por kilo)")).toHaveValue("190");
    expect(screen.getByLabelText("Costo de máquina (por hora)")).toHaveValue("2.75");
    // Los porcentajes se ven ×100.
    expect(screen.getByLabelText("Recargo por color adicional")).toHaveValue("15");
    // Las opciones cerradas, con su rótulo y no con su código.
    expect(screen.getByLabelText("Redondeo de los precios")).toHaveValue("unit");
    expect(screen.getByRole("option", { name: "A la unidad" })).toBeInTheDocument();
    // La ayuda del campo.
    expect(screen.getByText(/Incluye la luz y el desgaste/)).toBeInTheDocument();
    // La curva, con sus cuatro anclas.
    expect(within(screen.getByTestId("rows-marginCurve")).getAllByRole("row")).toHaveLength(5);
  });

  it("guarda un valor válido, aceptando la coma decimal", async () => {
    renderForm();
    const price = screen.getByLabelText("Costo de máquina (por hora)");
    await userEvent.clear(price);
    await userEvent.type(price, "3,5");
    await save();

    expect(estado.guardados).toHaveLength(1);
    expect(estado.guardados[0].slug).toBe(SLUG);
    expect(estado.guardados[0].config.machineCostPerHour).toBe(3.5);
    // Lo que no se tocó viaja igual: el porcentaje vuelve a ser fracción.
    expect(estado.guardados[0].config.colorSurcharge).toBe(0.15);
    expect(await screen.findByRole("status")).toHaveTextContent("Parámetros guardados.");
  });

  it("un valor que el esquema rechaza no se guarda y el motivo aparece junto al campo", async () => {
    renderForm();
    const price = screen.getByLabelText("Precio del filamento (por kilo)");
    await userEvent.clear(price);
    await userEvent.type(price, "-5");
    await save();

    expect(estado.guardados).toEqual([]);
    expect(price).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("No puede ser negativo");
  });

  it("un campo vacío se rechaza en vez de guardarse como cero", async () => {
    renderForm();
    await userEvent.clear(screen.getByLabelText("Precio del filamento (por kilo)"));
    await save();

    expect(estado.guardados).toEqual([]);
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un número");
  });

  it("lista de filas: se añade, se edita y se quita antes de guardar", async () => {
    renderForm();
    const extras = within(screen.getByTestId("rows-extras"));
    expect(extras.getByText("Todavía no hay ninguna fila.")).toBeInTheDocument();

    await userEvent.click(extras.getByRole("button", { name: "Añadir fila" }));
    await userEvent.click(extras.getByRole("button", { name: "Añadir fila" }));
    const first = within(screen.getByTestId("row-extras-0"));
    await userEvent.type(first.getByRole("textbox", { name: "Nombre" }), "Llavero");
    await userEvent.type(first.getByRole("textbox", { name: "Costo unitario" }), "0,5");
    // La segunda fila quedó vacía: se quita.
    await userEvent.click(
      extras.getByRole("button", { name: "Quitar la fila 2 de Insumos extra" }),
    );
    await save();

    expect(estado.guardados[0].config.extras).toEqual([{ name: "Llavero", cost: 0.5 }]);
  });

  it("una curva que haría bajar el precio nombra las anclas, en la fila culpable", async () => {
    renderForm();
    const second = within(screen.getByTestId("row-marginCurve-1"));
    const cost = second.getByRole("textbox", { name: "Si producirla cuesta" });
    const margin = second.getByRole("textbox", { name: "se vende al" });
    await userEvent.clear(cost);
    await userEvent.type(cost, "12");
    await userEvent.clear(margin);
    await userEvent.type(margin, "150");
    await save();

    expect(estado.guardados).toEqual([]);
    expect(margin).toHaveAttribute("aria-invalid", "true");
    expect(second.getByRole("alert")).toHaveTextContent(/Entre 10 y 12 el precio bajaría/);
  });

  it("si el servidor rechaza, su motivo se muestra y no se da por guardado", async () => {
    estado.respuesta = { error: "Solo la persona dueña puede administrar las herramientas." };
    renderForm();
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent(/dueña/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("si el servidor rechaza un campo, el error va a ese campo", async () => {
    estado.respuesta = {
      error: "No puede ser negativo",
      issues: [{ path: ["assemblyCost"], message: "No puede ser negativo" }],
    };
    renderForm();
    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent("No puede ser negativo");
    expect(screen.getByLabelText("Costo de un armado")).toHaveAttribute("aria-invalid", "true");
  });

  it("una herramienta que no está en el registro no pinta nada", () => {
    const { container } = render(<ConfigForm slug="no-existe" config={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
