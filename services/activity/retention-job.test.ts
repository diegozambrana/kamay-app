import { describe, expect, it, vi } from "vitest";

import { runRetentionJob } from "./retention-job";
import type { RetentionRun } from "./retention-service";

const EMPTY: RetentionRun = {
  exported: 0,
  purged: 0,
  exportPath: null,
  cutoff: "2025-09-11T00:00:00.000Z",
  months: 12,
};

describe("runRetentionJob", () => {
  it("atiende a cada organización aunque una falle, y reporta solo esa", async () => {
    const report = vi.fn();
    const run = vi.fn(async (organizationId: string) => {
      if (organizationId === "b") throw new Error("disco lleno");
      return EMPTY;
    });

    const result = await runRetentionJob({
      organizations: async () => ["a", "b", "c"],
      run,
      report,
    });

    expect(run.mock.calls.map(([id]) => id)).toEqual(["a", "b", "c"]);
    expect(result.organizations).toBe(3);
    expect(result.succeeded.map((entry) => entry.organizationId)).toEqual(["a", "c"]);
    expect(result.succeeded[0].summary).toContain("Nada que exportar");
    expect(result.failed).toEqual([{ organizationId: "b" }]);
    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(expect.any(Error), {
      job: "activity-retention",
      organizationId: "b",
    });
  });

  it("sin organizaciones no hace nada ni reporta nada", async () => {
    const report = vi.fn();
    const result = await runRetentionJob({
      organizations: async () => [],
      run: vi.fn(),
      report,
    });

    expect(result).toEqual({ organizations: 0, succeeded: [], failed: [] });
    expect(report).not.toHaveBeenCalled();
  });

  it("si ni siquiera se leen las organizaciones, el fallo sube a la ruta", async () => {
    await expect(
      runRetentionJob({
        organizations: async () => {
          throw new Error("sin conexión");
        },
        run: vi.fn(),
        report: vi.fn(),
      }),
    ).rejects.toThrow("sin conexión");
  });
});
