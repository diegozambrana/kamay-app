import { describe, expect, it } from "vitest";

import { STATUS_FLOWS } from "@/types";

import { DEFAULT_STATUS_SETS, defaultSetAsJson } from "./default-sets";

describe("DEFAULT_STATUS_SETS", () => {
  it.each(STATUS_FLOWS)(
    "el juego por defecto de %s tiene al menos un inicial y un final",
    (flow) => {
      const kinds = DEFAULT_STATUS_SETS[flow].map((status) => status.kind);
      expect(kinds).toContain("initial");
      expect(kinds).toContain("final");
    },
  );

  it.each(STATUS_FLOWS)(
    "en %s solo un estado de espera podría ser cola",
    (flow) => {
      for (const status of DEFAULT_STATUS_SETS[flow]) {
        if (status.isQueue) expect(status.kind).toBe("waiting");
      }
    },
  );

  it.each(STATUS_FLOWS)("las posiciones de %s son únicas y ascendentes", (flow) => {
    const positions = DEFAULT_STATUS_SETS[flow].map((status) => status.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("el juego de tareas es el de la especificación (los cuatro estados)", () => {
    expect(
      DEFAULT_STATUS_SETS.task.map((status) => [status.name, status.kind]),
    ).toEqual([
      ["Por hacer", "initial"],
      ["Haciendo", "in_progress"],
      ["En revisión", "waiting"],
      ["Hecho", "final"],
    ]);
  });

  it("defaultSetAsJson produce la forma snake_case que espera la base", () => {
    expect(defaultSetAsJson("task")[0]).toEqual({
      name: "Por hacer",
      kind: "initial",
      color: "zinc",
      is_queue: false,
      position: 1,
    });
  });
});
