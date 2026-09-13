import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type MonitoringEvent,
  reportError,
  setBrowserMonitoringScope,
  setMonitoringTransport,
} from "./report-error";

const ORG = "20000000-0000-0000-0000-000000000002";

let sent: MonitoringEvent[];

beforeEach(() => {
  sent = [];
  setMonitoringTransport((event) => {
    sent.push(event);
  });
  setBrowserMonitoringScope({ organizationId: ORG });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  window.history.replaceState(null, "", "/contacts/9?q=Ana");
});

afterEach(() => {
  setMonitoringTransport(null);
  setBrowserMonitoringScope({});
  vi.restoreAllMocks();
});

/**
 * KAM-23 · Escenario «Personal data never reaches the monitoring service»: un
 * error mientras se manipula un registro con datos de cliente e importes, como
 * los que PostgREST devuelve envueltos por un servicio.
 */
describe("un error sobre un registro con datos de cliente", () => {
  it("se reporta con versión, ruta y organización, y sin ningún dato personal", () => {
    const error = new Error(
      "No se pudo registrar el cobro: new row for relation payments violates check constraint payments_amount_check. " +
        "Failing row contains (9, Ana Pérez, ana.perez@gmail.com, 77712345, 540.00). " +
        'Detalle: el contacto "Ana Pérez" (ana.perez@gmail.com, +591 777-12345) debe 540.00 Bs',
    );

    reportError(error, {
      boundary: "Pedidos",
      // Lo que un llamador descuidado pase de más tampoco sale.
      ...({ customer: "Ana Pérez", amount: "540.00" } as object),
    });

    expect(sent).toHaveLength(1);
    const [event] = sent;
    expect(event.context).toEqual({
      boundary: "Pedidos",
      organizationId: ORG,
      route: "/contacts/9",
      runtime: "browser",
    });
    expect(event.release).toBe("local");

    const payload = JSON.stringify(event);
    for (const personal of ["Ana", "Pérez", "ana.perez@gmail.com", "77712345", "777-12345", "540.00", "q="]) {
      expect(payload, personal).not.toContain(personal);
    }
    // Y el error sigue siendo diagnosticable.
    expect(event.message).toContain("violates check constraint payments_amount_check");
  });

  it("el registro local también recibe la versión depurada", () => {
    reportError(new Error("fallo con ana@x.com"));
    expect(String(vi.mocked(console.error).mock.calls[0])).not.toContain("ana@x.com");
  });
});

/** KAM-23 · Escenario «Monitoring failure is invisible to the user». */
describe("un monitoreo que falla", () => {
  it("que lanza al entregar no añade un segundo error", () => {
    setMonitoringTransport(() => {
      throw new Error("proveedor caído");
    });
    expect(() => reportError(new Error("x"))).not.toThrow();
  });

  it("que rechaza no deja una promesa sin atender", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    setMonitoringTransport(() => Promise.reject(new Error("sin red")));

    reportError(new Error("x"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("que nunca responde no retrasa a quien reporta", () => {
    setMonitoringTransport(() => new Promise(() => undefined));
    const started = performance.now();
    reportError(new Error("x"));
    expect(performance.now() - started).toBeLessThan(50);
  });

  it("ni siquiera un registro local roto rompe nada", () => {
    vi.mocked(console.error).mockImplementation(() => {
      throw new Error("consola rota");
    });
    expect(() => reportError(new Error("x"))).not.toThrow();
  });
});
