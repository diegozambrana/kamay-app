import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOrganizationStore } from "@/stores/organization-store";
import { useSyncStore } from "@/stores/sync-store";

vi.mock("@/features/business-lines/line-selector", () => ({
  LineSelector: ({ testId }: { testId?: string }) => <div data-testid={testId} />,
}));

import { MobileContextBar } from "./mobile-context-bar";

afterEach(() => {
  cleanup();
  useSyncStore.setState({ items: [], counts: { pending: 0, held: 0, failed: 0, total: 0 } });
});

describe("MobileContextBar", () => {
  it("sigue llevando el selector de línea y el indicador de sincronización", () => {
    // KAM-13 reestructura la barra inferior, no la tira de contexto: el
    // indicador de KAM-11 se queda donde está y sigue alcanzable.
    useSyncStore.setState({
      items: [],
      counts: { pending: 2, held: 0, failed: 0, total: 2 },
    });
    useOrganizationStore.setState({ organization: null });

    render(<MobileContextBar />);

    const tira = screen.getByTestId("mobile-context-bar");
    expect(screen.getByTestId("line-selector-mobile")).toBeInTheDocument();
    expect(tira).toContainElement(screen.getByTestId("sync-indicator"));
  });

  it("la tira se ancla arriba, lejos de la barra y del flotante", () => {
    // La barra inferior y el botón *+ Registrar* son `fixed` abajo; esta tira
    // es `sticky top-0`. No se pisan (design D6).
    render(<MobileContextBar />);

    const clases = screen.getByTestId("mobile-context-bar").className;
    expect(clases).toContain("sticky");
    expect(clases).toContain("top-0");
  });
});
