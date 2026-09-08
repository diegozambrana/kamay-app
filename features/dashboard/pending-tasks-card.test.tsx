import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PendingTasksCard } from "./pending-tasks-card";

afterEach(cleanup);

/**
 * KAM-17 · La tarjeta de pendientes del panel.
 *
 * Escenarios del delta spec `dashboard` — requisito "Tarjeta de pendientes con
 * los tres conteos": «Los tres conteos», «De la tarjeta a los pendientes»,
 * «Sin nada pendiente» y «Pendientes ya no es marcador».
 *
 * «El ayudante cuenta lo suyo» y «El selector no altera la cuenta» se
 * verifican donde de verdad ocurren —la RLS en
 * `supabase/tests/task_access.test.sql` y la consulta en
 * `services/tasks/task-service.test.ts`—: esta tarjeta recibe los conteos ya
 * hechos y no podría alterarlos.
 */
describe("PendingTasksCard", () => {
  // Scenario: Los tres conteos
  it("muestra vencidas, hoy y próximos 7 días", () => {
    render(<PendingTasksCard counts={{ overdue: 2, today: 1, upcoming: 3 }} />);

    expect(screen.getByTestId("pending-overdue")).toHaveTextContent("2");
    expect(screen.getByTestId("pending-today")).toHaveTextContent("1");
    expect(screen.getByTestId("pending-upcoming")).toHaveTextContent("3");
  });

  it("destaca las vencidas en rojo", () => {
    render(<PendingTasksCard counts={{ overdue: 2, today: 0, upcoming: 0 }} />);

    expect(screen.getByTestId("pending-overdue").className).toContain(
      "text-destructive",
    );
  });

  it("sin vencidas no pinta nada de rojo", () => {
    render(<PendingTasksCard counts={{ overdue: 0, today: 3, upcoming: 1 }} />);

    expect(screen.getByTestId("pending-overdue").className).not.toContain(
      "text-destructive",
    );
  });

  // Scenario: De la tarjeta a los pendientes
  it("lleva a la pantalla de pendientes", () => {
    render(<PendingTasksCard counts={{ overdue: 1, today: 0, upcoming: 0 }} />);

    expect(screen.getByRole("link", { name: "Pendientes" })).toHaveAttribute(
      "href",
      "/my-tasks",
    );
  });

  // Scenario: Sin nada pendiente
  it("sin nada pendiente lo declara, con ceros reales", () => {
    render(<PendingTasksCard counts={{ overdue: 0, today: 0, upcoming: 0 }} />);

    expect(screen.getByText("No tienes tareas pendientes.")).toBeInTheDocument();
  });

  // Scenario: Pendientes ya no es marcador
  it("no es un marcador de posición y no lleva leyenda de no disponible", () => {
    render(<PendingTasksCard counts={{ overdue: 1, today: 2, upcoming: 0 }} />);

    expect(screen.getByTestId("pending-tasks-card")).not.toHaveAttribute(
      "data-placeholder",
    );
    expect(screen.queryByText(/no está disponible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/módulo de tareas/i)).not.toBeInTheDocument();
  });

  it("aun sin nada pendiente sigue enlazando a su pantalla", () => {
    // A diferencia de un marcador, que no debe llevar a ninguna parte: esta
    // pantalla ya existe.
    render(<PendingTasksCard counts={{ overdue: 0, today: 0, upcoming: 0 }} />);

    expect(screen.getByRole("link", { name: "Pendientes" })).toBeInTheDocument();
  });
});
