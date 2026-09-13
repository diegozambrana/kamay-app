import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestError } from "@/instrumentation";

import { type MonitoringEvent, setMonitoringTransport } from "./report-error";

const ORG = "20000000-0000-0000-0000-000000000002";

type Context = Parameters<typeof onRequestError>[2];

const RENDER: Context = {
  routerKind: "App Router",
  routePath: "/contacts/[id]",
  routeType: "render",
  renderSource: "react-server-components",
  revalidateReason: undefined,
};

let sent: MonitoringEvent[];

beforeEach(() => {
  // En el servidor no hay `window`: sin esto, el reporte tomaría la ruta y la
  // organización del navegador simulado de las pruebas unitarias.
  vi.stubGlobal("window", undefined);
  sent = [];
  setMonitoringTransport((event) => {
    sent.push(event);
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  setMonitoringTransport(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** KAM-23 · Escenario «An unhandled error is reported with context», en el servidor. */
describe("onRequestError", () => {
  it("reporta la ruta como plantilla, el tipo de ruta y la organización activa", async () => {
    await onRequestError(
      new Error("No se pudo cargar el contacto"),
      {
        path: "/contacts/9?q=Ana",
        method: "GET",
        headers: { cookie: `sb-access-token=eyJhbGciOiJI.eyJyb2xlIjoi.firma; kamay-org=${ORG}` },
      },
      RENDER,
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].context).toEqual({
      route: "/contacts/[id]",
      runtime: "render",
      organizationId: ORG,
    });
    // Ni la dirección con su consulta ni la cookie de sesión viajan.
    const payload = JSON.stringify(sent[0]);
    expect(payload).not.toContain("q=Ana");
    expect(payload).not.toContain("eyJ");
  });

  it("sin organización activa, reporta igual y sin inventarla", async () => {
    await onRequestError(new Error("x"), { path: "/auth/login", method: "GET", headers: {} }, {
      ...RENDER,
      routePath: "/auth/login",
    });
    expect(sent[0].context).toEqual({ route: "/auth/login", runtime: "render" });
  });
});
