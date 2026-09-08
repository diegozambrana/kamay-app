import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskCard, type TaskCardData } from "./task-card";

afterEach(cleanup);

function card(overrides: Partial<TaskCardData> = {}): TaskCardData {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Set de 6 tazas artesanales",
    dueDate: null,
    closedAt: null,
    assigneeName: "Ana Quispe",
    tags: [],
    lineName: "Alfarería",
    lineColor: "amber",
    ...overrides,
  } as TaskCardData;
}

function renderCard(onOpen = vi.fn()) {
  render(
    <TaskCard task={card()} today="2026-09-07" showLine={false} onOpen={onOpen} />,
  );
  return { onOpen, tarjeta: screen.getByTestId("task-card") };
}

/**
 * La tarjeta abre el detalle (V18) **solo si fue un clic**.
 *
 * Soltar una tarjeta arrastrada dispara también un clic. Cuando ese clic abría
 * un panel encima del tablero se cerraba solo y no molestaba; desde KAM-16
 * navega a otra pantalla, así que sin esta guarda cada arrastre sacaría a la
 * persona del tablero a mitad de gesto.
 */
describe("apertura del detalle desde la tarjeta", () => {
  it("un clic sin movimiento abre el detalle", () => {
    const { onOpen, tarjeta } = renderCard();

    fireEvent.pointerDown(tarjeta, { clientX: 100, clientY: 100 });
    fireEvent.click(tarjeta, { clientX: 100, clientY: 100 });

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("un temblor de un par de píxeles sigue siendo un clic", () => {
    const { onOpen, tarjeta } = renderCard();

    fireEvent.pointerDown(tarjeta, { clientX: 100, clientY: 100 });
    fireEvent.click(tarjeta, { clientX: 102, clientY: 101 });

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("un arrastre no abre el detalle", () => {
    const { onOpen, tarjeta } = renderCard();

    fireEvent.pointerDown(tarjeta, { clientX: 100, clientY: 100 });
    fireEvent.click(tarjeta, { clientX: 340, clientY: 120 });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("un arrastre vertical tampoco", () => {
    const { onOpen, tarjeta } = renderCard();

    fireEvent.pointerDown(tarjeta, { clientX: 100, clientY: 100 });
    fireEvent.click(tarjeta, { clientX: 101, clientY: 190 });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("cada gesto se mide desde su propio origen", () => {
    const { onOpen, tarjeta } = renderCard();

    // Primero un arrastre, que no abre.
    fireEvent.pointerDown(tarjeta, { clientX: 100, clientY: 100 });
    fireEvent.click(tarjeta, { clientX: 340, clientY: 120 });
    expect(onOpen).not.toHaveBeenCalled();

    // Y después un clic limpio, que sí: el origen del gesto anterior no
    // puede quedar contaminando el siguiente.
    fireEvent.pointerDown(tarjeta, { clientX: 340, clientY: 120 });
    fireEvent.click(tarjeta, { clientX: 340, clientY: 120 });
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
