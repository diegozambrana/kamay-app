import { describe, expect, it } from "vitest";

import { emailFor } from "./templates";

/**
 * KAM-17 · Los tres correos.
 *
 * Escenarios del delta spec `notifications` — requisitos "Correo transaccional
 * para lo vencido y lo asignado" («Los demás tipos no viajan por correo») y
 * "El enlace del correo abre exactamente esa tarea, con o sin sesión".
 */

const DESTINATARIO = { email: "ana@taller.test" };
const APP = "https://kamay.app";

describe("emailFor · qué viaja por correo", () => {
  it("el resumen diario, lo vencido y lo asignado sí viajan", () => {
    for (const type of ["due_summary", "task_overdue", "task_assigned"] as const) {
      const message = emailFor(
        {
          type,
          title: "Aviso",
          body: null,
          entityType: type === "due_summary" ? null : "task",
          entityId: type === "due_summary" ? null : "t1",
        },
        DESTINATARIO,
        APP,
      );

      expect(message, type).not.toBeNull();
    }
  });

  it("la revisión, el estancamiento y el inventario no viajan", () => {
    for (const type of [
      "task_review",
      "task_stalled",
      "stock_below_min",
    ] as const) {
      const message = emailFor(
        { type, title: "Aviso", body: null, entityType: "task", entityId: "t1" },
        DESTINATARIO,
        APP,
      );

      expect(message, type).toBeNull();
    }
  });
});

describe("emailFor · el enlace", () => {
  it("apunta exactamente a esa tarea, no a una pantalla genérica", () => {
    const message = emailFor(
      {
        type: "task_assigned",
        title: "Te asignaron «Set de 6 tazas»",
        body: null,
        entityType: "task",
        entityId: "abc-123",
      },
      DESTINATARIO,
      APP,
    );

    expect(message?.text).toContain("https://kamay.app/tasks/abc-123");
    expect(message?.html).toContain('href="https://kamay.app/tasks/abc-123"');
  });

  it("el resumen lleva a Mis pendientes", () => {
    const message = emailFor(
      {
        type: "due_summary",
        title: "Tienes 3 tareas para hoy",
        body: "Una · Dos · Tres",
        entityType: null,
        entityId: null,
      },
      DESTINATARIO,
      APP,
    );

    expect(message?.text).toContain("https://kamay.app/my-tasks");
  });

  it("una URL base con barra final no produce una doble barra", () => {
    const message = emailFor(
      {
        type: "task_overdue",
        title: "Se venció",
        body: null,
        entityType: "task",
        entityId: "t1",
      },
      DESTINATARIO,
      `${APP}/`,
    );

    expect(message?.text).toContain("https://kamay.app/tasks/t1");
    expect(message?.text).not.toContain("//tasks");
  });

  it("un aviso sin destino resoluble no se envía", () => {
    // Un correo cuyo enlace no lleva a ninguna parte es peor que no mandarlo.
    const message = emailFor(
      {
        type: "task_overdue",
        title: "Se venció",
        body: null,
        entityType: "task",
        entityId: null,
      },
      DESTINATARIO,
      APP,
    );

    expect(message).toBeNull();
  });
});

describe("emailFor · contenido", () => {
  it("siempre trae texto plano, y el HTML es opcional", () => {
    const message = emailFor(
      {
        type: "task_assigned",
        title: "Te asignaron «Set de 6 tazas»",
        body: null,
        entityType: "task",
        entityId: "t1",
      },
      DESTINATARIO,
      APP,
    );

    expect(message?.text).toContain("Te asignaron");
    expect(message?.subject).toBe("Te asignaron «Set de 6 tazas»");
    expect(message?.to).toBe("ana@taller.test");
  });

  it("el cuerpo del resumen llega entero", () => {
    const message = emailFor(
      {
        type: "due_summary",
        title: "Tienes 3 tareas para hoy",
        body: "Una · Dos · Tres",
        entityType: null,
        entityId: null,
      },
      DESTINATARIO,
      APP,
    );

    expect(message?.text).toContain("Una · Dos · Tres");
  });

  it("un título escrito por alguien no se interpreta como HTML", () => {
    // El título de una tarea lo escribe una persona: mismo criterio que
    // `lib/markdown/sanitize.ts`, lo que escribe alguien no se ejecuta.
    const message = emailFor(
      {
        type: "task_assigned",
        title: 'Tarea <img src=x onerror="alert(1)">',
        body: null,
        entityType: "task",
        entityId: "t1",
      },
      DESTINATARIO,
      APP,
    );

    expect(message?.html).not.toContain("<img");
    expect(message?.html).toContain("&lt;img");
  });
});
