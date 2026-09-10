import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RelatedTask } from "@/services/tasks/task-service";

import { ArchiveWarning } from "./archive-warning";

afterEach(cleanup);

function tarea(title: string, id: string): RelatedTask {
  return { id, title, statusName: "En curso", dueAt: null, closedAt: null };
}

/**
 * KAM-21 · El aviso antes de archivar un registro referenciado.
 *
 * Escenarios del delta spec `task-links-deliverables`, requisito "Archivar un
 * registro referenciado avisa y no rompe nada": «El aviso enumera las tareas»,
 * «El archivado sigue adelante», «Sin referencias no hay aviso».
 *
 * «Ningún vínculo queda roto» se verifica contra la base en
 * `supabase/tests/task_links.test.sql`: es una promesa del esquema, no de la
 * pantalla.
 */
describe("aviso al archivar", () => {
  // «El aviso enumera las tareas»
  it("enumera las tareas que referencian el registro", async () => {
    render(
      <ArchiveWarning
        open
        onOpenChange={() => {}}
        label="este ítem"
        onConfirm={() => {}}
        relatedTasks={[
          tarea("Set de 6 tazas", "1"),
          tarea("Revisar filamento", "2"),
          tarea("Cargar gastos de feria", "3"),
        ]}
      />,
    );

    expect(screen.getByText(/3 tareas apuntan/)).toBeInTheDocument();
    const list = screen.getByTestId("archive-warning-tasks");
    expect(list).toHaveTextContent("Set de 6 tazas");
    expect(list).toHaveTextContent("Revisar filamento");
    expect(list).toHaveTextContent("Cargar gastos de feria");
  });

  it("con una sola tarea lo dice en singular", () => {
    render(
      <ArchiveWarning
        open
        onOpenChange={() => {}}
        label="este pedido"
        onConfirm={() => {}}
        relatedTasks={[tarea("Diseñar arte", "1")]}
      />,
    );

    expect(screen.getByText(/Una tarea apunta/)).toBeInTheDocument();
  });

  // «El archivado sigue adelante»
  it("confirmar archiva: el aviso informa, no impide", async () => {
    const onConfirm = vi.fn();
    render(
      <ArchiveWarning
        open
        onOpenChange={() => {}}
        label="este contacto"
        onConfirm={onConfirm}
        relatedTasks={[tarea("Diseñar arte", "1")]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Archivar" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cancelar no archiva nada", async () => {
    const onConfirm = vi.fn();
    render(
      <ArchiveWarning
        open
        onOpenChange={() => {}}
        label="este contacto"
        onConfirm={onConfirm}
        relatedTasks={[tarea("Diseñar arte", "1")]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  // «Sin referencias no hay aviso»
  it("sin tareas que lo referencien no enumera nada", () => {
    render(
      <ArchiveWarning
        open
        onOpenChange={() => {}}
        label="este egreso"
        onConfirm={() => {}}
        relatedTasks={[]}
      />,
    );

    expect(screen.queryByTestId("archive-warning-tasks")).not.toBeInTheDocument();
    expect(screen.queryByText(/apuntan a este registro/)).not.toBeInTheDocument();
  });
});
