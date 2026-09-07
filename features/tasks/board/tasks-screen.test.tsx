import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBoardStore } from "@/stores/board-store";
import type { Status, StatusKind, Tag } from "@/types";

import type { BoardTask } from "./board-view";
import { TasksScreen } from "./tasks-screen";

vi.mock("@/actions/tasks", () => ({
  moveTaskToStatus: vi.fn(async () => undefined),
  createTask: vi.fn(async () => ({ taskId: "nueva" })),
  updateTaskFields: vi.fn(async () => undefined),
  archiveTask: vi.fn(async () => undefined),
}));

const pushed: string[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (url: string) => pushed.push(url) }),
  useSearchParams: () => new URLSearchParams(),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const SUBLI = "22222222-2222-4222-8222-222222222222";
const TODAY = "2026-09-07";

let counter = 0;
function status(name: string, kind: StatusKind): Status {
  counter += 1;
  return {
    id: `70000000-0000-4000-8000-0000000000${String(counter).padStart(2, "0")}`,
    organizationId: ORG,
    businessLineId: SUBLI,
    flow: "task",
    name,
    kind,
    color: "zinc",
    position: counter,
    isQueue: false,
    archivedAt: null,
  };
}

let porHacer: Status;
let haciendo: Status;
let enRevision: Status;
let hecho: Status;

function task(overrides: Partial<BoardTask> = {}): BoardTask {
  return {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    statusId: porHacer.id,
    title: "Diseñar arte",
    dueDate: null,
    closedAt: null,
    assigneeName: null,
    tags: [],
    lineName: "Sublimación",
    lineColor: "blue",
    ...overrides,
  };
}

function renderScreen(props: Partial<Parameters<typeof TasksScreen>[0]> = {}) {
  const statuses = [porHacer, haciendo, enRevision, hecho];
  return render(
    <TasksScreen
      tasks={[task()]}
      statuses={statuses}
      allStatuses={statuses}
      assignees={[{ userId: "u1", displayName: "Ana" }]}
      tags={[]}
      activeLineId={SUBLI}
      quickAddLineId={SUBLI}
      view="board"
      search=""
      assigneeId=""
      tagId=""
      statusId=""
      includeArchived={false}
      today={TODAY}
      {...props}
    />,
  );
}

beforeEach(() => {
  counter = 0;
  porHacer = status("Por hacer", "initial");
  haciendo = status("Haciendo", "in_progress");
  enRevision = status("En revisión", "waiting");
  hecho = status("Hecho", "final");
  pushed.length = 0;
  useBoardStore.setState({ pending: {}, pendingQueue: {} });
});

afterEach(cleanup);

/**
 * KAM-15 · V17.
 *
 * Escenarios del delta spec `tasks` — requisitos "Las columnas del tablero
 * salen del juego de estados de la línea", "Tarjeta de tarea" y "Vistas lista
 * y calendario y filtros del tablero".
 */
describe("TasksScreen · columnas", () => {
  it("las columnas son el juego resuelto, en su orden", () => {
    renderScreen();

    const columns = screen.getAllByTestId("task-column");
    expect(columns.map((c) => c.dataset.statusName)).toEqual([
      "Por hacer",
      "Haciendo",
      "En revisión",
      "Hecho",
    ]);
  });

  it("un estado añadido aparece como columna sin tocar el código", () => {
    const extra = status("Esperando material", "waiting");
    renderScreen({
      statuses: [porHacer, extra, hecho],
      allStatuses: [porHacer, extra, hecho],
    });

    const columns = screen.getAllByTestId("task-column");
    expect(columns.map((c) => c.dataset.statusName)).toContain(
      "Esperando material",
    );
  });

  it("con «Todas» el tablero pide elegir línea; lista y calendario sí cruzan", () => {
    renderScreen({ activeLineId: null, statuses: [] });
    expect(screen.getByTestId("pick-a-line")).toBeInTheDocument();

    cleanup();
    renderScreen({ activeLineId: null, statuses: [], view: "list" });
    expect(screen.getByTestId("tasks-list")).toBeInTheDocument();
  });

  it("la tarea aparece en la columna de su estado", () => {
    renderScreen({ tasks: [task({ statusId: enRevision.id })] });

    const columns = screen.getAllByTestId("task-column");
    const revision = columns.find((c) => c.dataset.statusName === "En revisión")!;
    expect(within(revision).getByTestId("task-card")).toBeInTheDocument();
  });
});

describe("TasksScreen · tarjeta", () => {
  it("con el filtro en «Todas», la tarjeta muestra el color de su línea", () => {
    renderScreen({ activeLineId: null, view: "list" });

    const row = screen.getByTestId("task-row");
    expect(row.querySelector(".bg-blue-500")).not.toBeNull();
  });

  it("con una línea activa no se pinta el color: no distinguiría nada", () => {
    renderScreen({ view: "list" });

    const row = screen.getByTestId("task-row");
    expect(row.querySelector(".bg-blue-500")).toBeNull();
  });

  it("una fecha pasada se señala como vencida", () => {
    renderScreen({ tasks: [task({ dueDate: "2026-09-01" })] });

    expect(screen.getByTestId("task-card").dataset.dueSignal).toBe("overdue");
  });

  it("una tarea sin fecha no muestra ninguna señal", () => {
    renderScreen({ tasks: [task({ dueDate: null })] });

    expect(screen.getByTestId("task-card").dataset.dueSignal).toBe("none");
  });

  it("el responsable se identifica en la tarjeta", () => {
    renderScreen({ tasks: [task({ assigneeName: "Ana Quispe" })] });

    expect(screen.getByText("Ana Quispe")).toBeInTheDocument();
  });

  it("las etiquetas se muestran", () => {
    const tags: Tag[] = [{ id: "t1", organizationId: ORG, name: "hornada-07" }];
    renderScreen({ tasks: [task({ tags })] });

    expect(screen.getByText("hornada-07")).toBeInTheDocument();
  });
});

describe("TasksScreen · vistas y filtros", () => {
  it("la vista de calendario agrupa por fecha y aparta las que no la tienen", () => {
    renderScreen({
      view: "calendar",
      tasks: [
        task({ id: "con", dueDate: "2026-09-20" }),
        task({ id: "sin", dueDate: null }),
      ],
    });

    expect(screen.getByTestId("calendar-day").dataset.day).toBe("2026-09-20");
    expect(screen.getByTestId("calendar-undated")).toBeInTheDocument();
  });

  it("cambiar de vista solo cambia `view`, así que los filtros sobreviven", () => {
    renderScreen({ search: "arte", assigneeId: "u1" });

    screen.getByRole("radio", { name: "Lista" }).click();

    // La dirección conserva lo demás porque nunca salió de ella.
    expect(pushed[0]).toContain("view=list");
  });

  it("el filtro por responsable viaja a la dirección", () => {
    renderScreen();

    const select = screen.getByLabelText("Responsable") as HTMLSelectElement;
    select.value = "u1";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(pushed[0]).toContain("assignee=u1");
  });

  it("«Ver archivadas» viaja a la dirección", () => {
    renderScreen();

    screen.getByLabelText("Ver archivadas").click();

    expect(pushed[0]).toContain("archived=1");
  });

  it("la lista nombra el estado de cada tarea", () => {
    renderScreen({ view: "list", tasks: [task({ statusId: haciendo.id })] });

    // Acotado a la fila: "Haciendo" también es una opción del filtro de estado.
    const row = screen.getByTestId("task-row");
    expect(within(row).getByText("Haciendo")).toBeInTheDocument();
  });
});
