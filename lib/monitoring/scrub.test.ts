import { describe, expect, it } from "vitest";

import { scrubEvent, scrubRoute, scrubText } from "./scrub";

const ORG = "20000000-0000-0000-0000-000000000002";

describe("scrubText", () => {
  it("quita correos, teléfonos e importes", () => {
    expect(scrubText("Escribir a ana.perez@gmail.com o al 7777-1234 por 540.00")).toBe(
      "Escribir a [correo] o al [número] por [importe]",
    );
  });

  it("quita los importes con moneda y con separador de miles", () => {
    expect(scrubText("Saldo Bs 1.250,50 y 1,250.50 y 300 Bs y $ 20")).toBe(
      "Saldo [importe] y [importe] y [importe] y [importe]",
    );
  });

  it("quita el valor de una clave duplicada y la fila rechazada de Postgres", () => {
    expect(
      scrubText(
        "duplicate key value violates unique constraint contacts_email_key. Key (organization_id, email)=(abc, ana@x.com) already exists",
      ),
    ).toBe(
      "duplicate key value violates unique constraint contacts_email_key. Key (organization_id, email)=([valor]) already exists",
    );
    expect(scrubText("Failing row contains (1, Ana Pérez, 540.00, null).")).toBe(
      "Failing row contains ([fila]).",
    );
  });

  it("quita todo texto citado", () => {
    expect(scrubText('invalid input syntax for type uuid: "Ana Pérez"')).toBe(
      "invalid input syntax for type uuid: [texto]",
    );
    expect(scrubText("No se pudo guardar «Taza de Ana»")).toBe("No se pudo guardar [texto]");
  });

  it("quita credenciales y consultas de una dirección", () => {
    expect(scrubText("Bearer abc.def y sb_secret_XYZ123 en /contacts?q=Ana")).toBe(
      "Bearer [credencial] y [credencial] en /contacts?[consulta]",
    );
    expect(scrubText("token eyJhbGciOiJI.eyJyb2xlIjoi.firma")).toBe("token [credencial]");
  });

  it("conserva los identificadores y el resto del mensaje", () => {
    expect(scrubText(`No se pudo cargar el pedido ${ORG}: sin conexión`)).toBe(
      `No se pudo cargar el pedido ${ORG}: sin conexión`,
    );
  });

  it("no toca las posiciones de una traza", () => {
    const stack = "Error: x\n    at f (.next/server/chunks/ssr/a.js:1:7522)";
    expect(scrubText(stack)).toBe(stack);
  });
});

describe("scrubRoute", () => {
  it("quita la consulta y el fragmento", () => {
    expect(scrubRoute("/contacts?q=Ana%20P%C3%A9rez#fila")).toBe("/contacts");
  });

  it("quita el token de una invitación y cualquier segmento con forma de token", () => {
    expect(scrubRoute("/auth/invite/Zx9_q3LmN0pRsTuVwXyZ01234567")).toBe("/auth/invite/[token]");
    expect(scrubRoute("/algo/Zx9_q3LmN0pRsTuVwXyZ01234567")).toBe("/algo/[token]");
  });

  it("conserva plantillas e identificadores", () => {
    expect(scrubRoute("/orders/[id]")).toBe("/orders/[id]");
    expect(scrubRoute(`/orders/${ORG}`)).toBe(`/orders/${ORG}`);
  });
});

describe("scrubEvent", () => {
  it("solo deja pasar el contexto de la lista cerrada", () => {
    const event = scrubEvent({
      name: "Error",
      message: "x",
      release: "abc123",
      context: {
        boundary: "Pedidos",
        organizationId: ORG,
        digest: "880299376@E1180",
        // Lo que alguien pase de más no sale.
        ...({ customer: "Ana Pérez", headers: { cookie: "sb=1" } } as object),
      },
    });
    expect(event.context).toEqual({
      boundary: "Pedidos",
      organizationId: ORG,
      digest: "880299376@E1180",
    });
  });

  it("descarta una organización o un digest con forma inesperada", () => {
    const event = scrubEvent({
      name: "Error",
      message: "x",
      release: "local",
      context: { organizationId: "Taller de Ana", digest: "a b" },
    });
    expect(event.context).toEqual({});
  });
});
