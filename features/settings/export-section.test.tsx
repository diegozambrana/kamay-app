import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExportSection } from "./export-section";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  // jsdom no implementa las URL de objeto.
  URL.createObjectURL = vi.fn(() => "blob:kamay");
  URL.revokeObjectURL = vi.fn();
});

function zipResponse(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([80, 75, 3, 4]));
      controller.enqueue(new Uint8Array(2048));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-disposition": 'attachment; filename="kamay-exportacion-geeko-store-2026-09-11.zip"' },
  });
}

/**
 * Spec `data-export` → *The export is available at any moment and reports its
 * progress*.
 */
describe("ExportSection", () => {
  // «Export is requested on demand»
  it("exporta en el acto y entrega el archivo con su nombre", async () => {
    const fetch = vi.fn().mockResolvedValue(zipResponse());
    vi.stubGlobal("fetch", fetch);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ExportSection isOwner />);
    await userEvent.click(screen.getByRole("button", { name: /Descargar exportación/ }));

    expect(fetch).toHaveBeenCalledWith("/settings/export/download", { cache: "no-store" });
    expect(await screen.findByText(/Listo: kamay-exportacion-geeko-store-2026-09-11.zip/)).toBeInTheDocument();
    expect(click).toHaveBeenCalledOnce();
  });

  // «A failed export explains itself»
  it("un fallo se explica en lenguaje humano, sin códigos, y ofrece reintentar", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 500 }))
      .mockResolvedValueOnce(zipResponse());
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ExportSection isOwner />);
    await userEvent.click(screen.getByRole("button", { name: /Descargar exportación/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo preparar la exportación.");
    expect(alert).not.toHaveTextContent(/500|HTTP|boom/);

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/Listo:/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("al ayudante le dice qué no va a encontrar", () => {
    render(<ExportSection isOwner={false} />);
    expect(screen.getByText(/los egresos, los activos y la bitácora no/)).toBeInTheDocument();
  });
});
