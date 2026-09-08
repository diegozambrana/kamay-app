import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownView } from "./markdown-view";

afterEach(cleanup);

/**
 * Cubre *El Markdown rendido se sanea*.
 *
 * Se prueba a través de `MarkdownView` a propósito: el requisito no es que
 * exista un esquema correcto, sino que **no haya forma de rendir sin sanear**
 * (design D1). Probar el esquema por separado dejaría fuera precisamente el
 * cableado que lo garantiza.
 */
describe("saneado del Markdown rendido", () => {
  it("no ejecuta un script del cuerpo", () => {
    const ejecutado = vi.fn();
    Reflect.set(globalThis, "__kamayScriptCanary", ejecutado);

    const { container } = render(
      <MarkdownView>
        {"Antes\n\n<script>globalThis.__kamayScriptCanary()</script>\n\nDespués"}
      </MarkdownView>,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("__kamayScriptCanary");
    expect(ejecutado).not.toHaveBeenCalled();
    // El texto que rodeaba al script sobrevive: sanear no es vaciar.
    expect(container.textContent).toContain("Antes");
    expect(container.textContent).toContain("Después");

    Reflect.deleteProperty(globalThis, "__kamayScriptCanary");
  });

  it("no rinde el HTML escrito a mano", () => {
    const { container } = render(
      <MarkdownView>
        {[
          '<img src="x" alt="Taza" onerror="globalThis.__kamayImgCanary = true">',
          "",
          '<iframe src="https://ejemplo.test"></iframe>',
        ].join("\n")}
      </MarkdownView>,
    );

    // El HTML crudo no se interpreta (design D1): no llega ningún elemento, y
    // tampoco su texto, así que `onerror` no tiene por dónde dispararse.
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    expect(container.innerHTML).not.toContain("iframe");
    expect(Reflect.get(globalThis, "__kamayImgCanary")).toBeUndefined();
  });

  it("rinde una imagen de sintaxis Markdown sin su origen remoto", () => {
    const { container } = render(
      <MarkdownView>{"![Taza de gres](https://tercero.test/taza.jpg)"}</MarkdownView>,
    );

    const imagen = container.querySelector("img");
    expect(imagen).not.toBeNull();
    expect(imagen?.getAttribute("alt")).toBe("Taza de gres");
    // El elemento sobrevive con su texto alternativo; la petición al tercero,
    // no (design D1).
    expect(imagen?.getAttribute("src")).toBeNull();
  });

  it("no conserva el destino de un enlace con esquema javascript", () => {
    const { container } = render(
      <MarkdownView>{"[Pulsa aquí](javascript:alert(1))"}</MarkdownView>,
    );

    const enlace = container.querySelector("a");
    expect(enlace?.getAttribute("href") ?? "").not.toContain("javascript:");
    // El texto del enlace sigue ahí: se desactiva el destino, no el contenido.
    expect(container.textContent).toContain("Pulsa aquí");
  });

  it("conserva el formato legítimo", () => {
    const { container } = render(
      <MarkdownView>
        {[
          "# Proceso de la hornada 07",
          "",
          "Set de **6 tazas** de gres con esmalte *celeste*.",
          "",
          "- Modelado",
          "- Secado",
          "",
          "[Ficha del esmalte](https://ejemplo.test/ficha)",
        ].join("\n")}
      </MarkdownView>,
    );

    expect(container.querySelector("h1")?.textContent).toBe(
      "Proceso de la hornada 07",
    );
    expect(container.querySelector("strong")?.textContent).toBe("6 tazas");
    expect(container.querySelector("em")?.textContent).toBe("celeste");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);

    const enlace = container.querySelector("a");
    expect(enlace?.getAttribute("href")).toBe("https://ejemplo.test/ficha");
    expect(enlace?.textContent).toBe("Ficha del esmalte");
  });

  it("sanea un cuerpo guardado antes de que el saneado existiera", () => {
    // El mismo cuerpo peligroso que si viniera de la base de datos: nunca pasó
    // por un saneado al escribirse, porque el cuerpo se guarda crudo.
    const cuerpoAntiguo =
      "Notas de la hornada\n\n<script>globalThis.__kamayLegacyCanary = true</script>\n\n<img src=\"y\" onerror=\"globalThis.__kamayLegacyCanary = true\">";

    const { container } = render(<MarkdownView>{cuerpoAntiguo}</MarkdownView>);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    expect(Reflect.get(globalThis, "__kamayLegacyCanary")).toBeUndefined();
    expect(container.textContent).toContain("Notas de la hornada");
  });
});
