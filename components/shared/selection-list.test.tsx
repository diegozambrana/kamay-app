import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SelectionList, type SelectionMode } from "./selection-list";

afterEach(cleanup);

type Row = { id: string; name: string };

const ROWS: Row[] = [
  { id: "a", name: "Taza para sublimación" },
  { id: "b", name: "Maceta de barro" },
  { id: "c", name: "Taza blanca" },
];

function Harness({
  mode,
  initial = [],
  withEmpty = false,
}: {
  mode: SelectionMode;
  initial?: string[];
  withEmpty?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  return (
    <>
      <SelectionList
        items={ROWS}
        getKey={(row) => row.id}
        getSearchText={(row) => row.name}
        renderItem={(row) => row.name}
        mode={mode}
        selected={selected}
        onSelectedChange={setSelected}
        label="Productos"
        empty={withEmpty ? (term) => <p>Nada para «{term}»</p> : undefined}
      />
      <output data-testid="selected">{selected.join(",")}</output>
    </>
  );
}

const option = (name: string) => screen.getByRole("option", { name });
const filter = () => screen.getByRole("combobox", { name: "Productos" });

describe("SelectionList", () => {
  it("filtra ignorando acentos y mayúsculas", async () => {
    render(<Harness mode="multiple" />);

    await userEvent.type(filter(), "SUBLIMACION");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(option("Taza para sublimación")).toBeInTheDocument();
  });

  it("en modo múltiple marca y desmarca, y lo marcado sobrevive al filtro", async () => {
    render(<Harness mode="multiple" />);

    await userEvent.click(option("Taza blanca"));
    await userEvent.click(option("Maceta de barro"));
    await userEvent.click(option("Maceta de barro"));
    expect(screen.getByTestId("selected")).toHaveTextContent(/^c$/);

    await userEvent.type(filter(), "maceta");
    expect(screen.queryByRole("option", { name: "Taza blanca" })).toBeNull();
    await userEvent.click(option("Maceta de barro"));

    await userEvent.clear(filter());
    expect(screen.getByTestId("selected")).toHaveTextContent("c,b");
    expect(option("Taza blanca")).toHaveAttribute("aria-checked", "true");
    expect(option("Maceta de barro")).toHaveAttribute("aria-checked", "true");
    expect(option("Taza para sublimación")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("en modo simple marcar otra fila reemplaza la anterior", async () => {
    render(<Harness mode="single" initial={["a"]} />);

    expect(option("Taza para sublimación")).toHaveAttribute("aria-checked", "true");
    await userEvent.click(option("Maceta de barro"));

    expect(screen.getByTestId("selected")).toHaveTextContent(/^b$/);
    expect(option("Taza para sublimación")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("sin coincidencias rinde el contenido vacío con el término", async () => {
    render(<Harness mode="single" withEmpty />);

    await userEvent.type(filter(), "Florería");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Nada para «Florería»")).toBeInTheDocument();
  });

  it("las flechas y Enter marcan desde el teclado", async () => {
    render(<Harness mode="multiple" />);

    await userEvent.click(filter());
    // La primera fila ya está resaltada; bajar una lleva a la segunda.
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByTestId("selected")).toHaveTextContent(/^b$/);
  });
});
