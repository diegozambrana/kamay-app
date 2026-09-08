import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Notification, NotificationGroup } from "@/types";

import { NotificationList } from "./notification-list";

afterEach(cleanup);

/**
 * KAM-17 · La bandeja V21.
 *
 * Escenarios del delta spec `notifications` — requisitos "Bandeja de
 * notificaciones agrupada por tipo" («Agrupada por tipo», «Bandeja vacía»,
 * «Marcar leída»), "Cada aviso lleva a su registro" («Del aviso a la tarea»,
 * «Del resumen a los pendientes», «Registro ya no disponible») y "El tipo de
 * insumo bajo mínimo se declara sin generador" («Nada se rompe por su
 * ausencia»).
 */

const TZ = "America/La_Paz";

function aviso(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    organizationId: "o1",
    userId: "u1",
    type: "task_assigned",
    title: "Te asignaron «Set de 6 tazas»",
    body: null,
    entityType: "task",
    entityId: "t1",
    readAt: null,
    createdAt: "2026-09-08T10:00:00.000Z",
    ...overrides,
  };
}

function renderList(
  groups: NotificationGroup[],
  options: { available?: Set<string> } = {},
) {
  const onMarkRead = vi.fn();
  const onMarkAllRead = vi.fn();

  render(
    <NotificationList
      groups={groups}
      onMarkRead={onMarkRead}
      onMarkAllRead={onMarkAllRead}
      timezone={TZ}
      available={options.available}
    />,
  );

  return { onMarkRead, onMarkAllRead };
}

describe("NotificationList", () => {
  // Scenario: Bandeja vacía
  it("sin avisos muestra un mensaje de lista sin contenido, no una lista en blanco", () => {
    renderList([]);

    expect(screen.getByTestId("notifications-empty")).toHaveTextContent(
      "No tienes avisos.",
    );
  });

  // Scenario: Agrupada por tipo
  it("agrupa por tipo con su encabezado, no en una sola tira", () => {
    renderList([
      { type: "due_summary", notifications: [aviso({ id: "n1", type: "due_summary", entityType: null, entityId: null })] },
      { type: "task_assigned", notifications: [aviso({ id: "n2" })] },
      { type: "task_overdue", notifications: [aviso({ id: "n3", type: "task_overdue" })] },
    ]);

    expect(screen.getByTestId("notification-group-due_summary")).toBeInTheDocument();
    expect(screen.getByTestId("notification-group-task_assigned")).toBeInTheDocument();
    expect(screen.getByTestId("notification-group-task_overdue")).toBeInTheDocument();
    expect(screen.getByText("Tareas asignadas")).toBeInTheDocument();
  });

  it("destaca las no leídas", () => {
    renderList([
      {
        type: "task_assigned",
        notifications: [
          aviso({ id: "sinleer", readAt: null }),
          aviso({ id: "leida", readAt: "2026-09-08T11:00:00.000Z" }),
        ],
      },
    ]);

    expect(screen.getByTestId("notification-sinleer").className).toContain(
      "bg-accent/50",
    );
    expect(screen.getByTestId("notification-leida").className).not.toContain(
      "bg-accent/50",
    );
  });

  // Scenario: Del aviso a la tarea
  it("un aviso de tarea abre esa tarea concreta", () => {
    renderList([
      { type: "task_assigned", notifications: [aviso({ entityId: "abc-123" })] },
    ]);

    expect(screen.getByTestId("notification-n1")).toHaveAttribute(
      "href",
      "/tasks/abc-123",
    );
  });

  // Scenario: Del resumen a los pendientes
  it("el resumen lleva a Mis pendientes", () => {
    renderList([
      {
        type: "due_summary",
        notifications: [
          aviso({ type: "due_summary", entityType: null, entityId: null }),
        ],
      },
    ]);

    expect(screen.getByTestId("notification-n1")).toHaveAttribute(
      "href",
      "/my-tasks",
    );
  });

  // Scenario: Registro ya no disponible
  it("un aviso cuya tarea se archivó lo declara y no ofrece enlace", () => {
    renderList(
      [{ type: "task_assigned", notifications: [aviso({ entityId: "ida" })] }],
      { available: new Set() },
    );

    const row = screen.getByTestId("notification-n1");
    expect(row).not.toHaveAttribute("href");
    expect(row).toHaveTextContent("Ya no está disponible");
  });

  // Scenario: Marcar leída
  it("abrir una no leída la marca leída", async () => {
    const { onMarkRead } = renderList([
      { type: "task_assigned", notifications: [aviso()] },
    ]);

    await userEvent.click(screen.getByTestId("notification-n1"));

    expect(onMarkRead).toHaveBeenCalledWith("n1");
  });

  it("abrir una ya leída no vuelve a marcarla", async () => {
    const { onMarkRead } = renderList([
      {
        type: "task_assigned",
        notifications: [aviso({ readAt: "2026-09-08T11:00:00.000Z" })],
      },
    ]);

    await userEvent.click(screen.getByTestId("notification-n1"));

    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("ofrece marcar todas cuando hay algo sin leer", async () => {
    const { onMarkAllRead } = renderList([
      { type: "task_assigned", notifications: [aviso()] },
    ]);

    await userEvent.click(
      screen.getByRole("button", { name: /Marcar todas como leídas/ }),
    );

    expect(onMarkAllRead).toHaveBeenCalled();
  });

  it("sin nada sin leer no ofrece marcar todas", () => {
    renderList([
      {
        type: "task_assigned",
        notifications: [aviso({ readAt: "2026-09-08T11:00:00.000Z" })],
      },
    ]);

    expect(
      screen.queryByRole("button", { name: /Marcar todas como leídas/ }),
    ).not.toBeInTheDocument();
  });

  // Scenario: Nada se rompe por su ausencia
  it("sabe rendir un aviso de insumo bajo mínimo aunque nada lo genere aún", () => {
    // El tipo existe en el catálogo desde la migración de KAM-17; su
    // generador es de KAM-18. La bandeja no puede romperse el día que llegue.
    renderList([
      {
        type: "stock_below_min",
        notifications: [
          aviso({ type: "stock_below_min", entityType: "item", entityId: "i1" }),
        ],
      },
    ]);

    expect(screen.getByText("Insumos bajo mínimo")).toBeInTheDocument();
    expect(screen.getByTestId("notification-n1")).toHaveAttribute(
      "href",
      "/catalog/i1",
    );
  });
});
