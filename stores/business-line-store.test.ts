import { beforeEach, describe, expect, it } from "vitest";

import { useBusinessLineStore } from "@/stores/business-line-store";
import { ALL_LINES, type BusinessLine } from "@/types";

const LINE: BusinessLine = {
  id: "l1",
  organizationId: "o1",
  name: "Sublimación",
  color: "blue",
  icon: null,
  isShared: false,
  position: 1,
  archivedAt: null,
};

describe("useBusinessLineStore", () => {
  beforeEach(() => {
    useBusinessLineStore.setState({ lines: [], activeLine: ALL_LINES });
  });

  it("arranca sin líneas y en Todas", () => {
    expect(useBusinessLineStore.getState().lines).toEqual([]);
    expect(useBusinessLineStore.getState().activeLine).toBe(ALL_LINES);
  });

  it("setLines guarda las líneas vigentes", () => {
    useBusinessLineStore.getState().setLines([LINE]);
    expect(useBusinessLineStore.getState().lines).toEqual([LINE]);
  });

  it("setActiveLine cambia el contexto y puede volver a Todas", () => {
    useBusinessLineStore.getState().setActiveLine(LINE.id);
    expect(useBusinessLineStore.getState().activeLine).toBe(LINE.id);

    useBusinessLineStore.getState().setActiveLine(ALL_LINES);
    expect(useBusinessLineStore.getState().activeLine).toBe(ALL_LINES);
  });
});
