import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  activeToolsFor,
  roleReaches,
  toolBySlug,
  toolHref,
  toolNavItems,
  usableTool,
} from "@/tools/resolve";
import type { AnyToolManifest } from "@/tools/types";

/**
 * KAM-27 · spec `tenant-tools` → *Las herramientas disponibles salen de un
 * registro en código* y *Una herramienta activa tiene página propia*.
 *
 * El registro real solo tiene una herramienta, y es de dueña. Los casos de
 * ayudante y de enganche se prueban con manifiestos de mentira inyectados.
 */
function fakeTool(overrides: Partial<AnyToolManifest>): AnyToolManifest {
  return {
    slug: "fake",
    name: "De mentira",
    description: "Solo para pruebas.",
    minRole: "owner",
    hooks: ["page"],
    capabilities: { network: false, credentials: false, produces: "nada" },
    tables: { reads: [], writes: [] },
    configSchema: z.object({}),
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    defaults: {},
    fixtures: [],
    run: () => ({}),
    ...overrides,
  };
}

const ownerTool = fakeTool({ slug: "owner-tool", name: "De dueña", hooks: ["page", "order-detail"] });
const assistantTool = fakeTool({ slug: "assistant-tool", name: "De ayudante", minRole: "assistant" });
const registry = [ownerTool, assistantTool];

describe("roleReaches", () => {
  it("el mínimo `assistant` lo alcanzan los dos roles; `owner`, solo la dueña", () => {
    expect(roleReaches("owner", "owner")).toBe(true);
    expect(roleReaches("assistant", "owner")).toBe(false);
    expect(roleReaches("owner", "assistant")).toBe(true);
    expect(roleReaches("assistant", "assistant")).toBe(true);
  });
});

describe("toolBySlug", () => {
  it("encuentra la herramienta o devuelve null", () => {
    expect(toolBySlug("owner-tool", registry)).toBe(ownerTool);
    expect(toolBySlug("no-existe", registry)).toBeNull();
  });
});

describe("activeToolsFor", () => {
  it("sin nada activo, no hay herramientas", () => {
    expect(activeToolsFor([], "owner", { registry })).toEqual([]);
  });

  it("devuelve solo las activas para esta organización", () => {
    expect(activeToolsFor(["owner-tool"], "owner", { registry })).toEqual([ownerTool]);
  });

  it("un slug activo que ya no está en el registro se ignora sin lanzar", () => {
    expect(activeToolsFor(["retirada", "owner-tool"], "owner", { registry })).toEqual([ownerTool]);
  });

  it("el rol filtra: el ayudante no ve la herramienta de dueña", () => {
    const slugs = ["owner-tool", "assistant-tool"];
    expect(activeToolsFor(slugs, "assistant", { registry })).toEqual([assistantTool]);
    expect(activeToolsFor(slugs, "owner", { registry })).toEqual([ownerTool, assistantTool]);
  });

  it("el enganche filtra", () => {
    const slugs = ["owner-tool", "assistant-tool"];
    expect(activeToolsFor(slugs, "owner", { registry, hook: "order-detail" })).toEqual([ownerTool]);
    expect(activeToolsFor(slugs, "owner", { registry, hook: "page" })).toEqual(registry);
  });

  it("el orden es el del registro, no el de la base", () => {
    expect(activeToolsFor(["assistant-tool", "owner-tool"], "owner", { registry })).toEqual(registry);
  });
});

describe("usableTool", () => {
  it("activa y con rol suficiente", () => {
    expect(usableTool("owner-tool", ["owner-tool"], "owner", { registry })).toBe(ownerTool);
  });

  it("no activa", () => {
    expect(usableTool("owner-tool", [], "owner", { registry })).toBeNull();
  });

  it("rol insuficiente", () => {
    expect(usableTool("owner-tool", ["owner-tool"], "assistant", { registry })).toBeNull();
  });

  it("rol suficiente para el ayudante", () => {
    expect(usableTool("assistant-tool", ["assistant-tool"], "assistant", { registry })).toBe(
      assistantTool,
    );
  });

  it("fuera del registro", () => {
    expect(usableTool("retirada", ["retirada"], "owner", { registry })).toBeNull();
  });

  it("sin el enganche pedido", () => {
    expect(
      usableTool("assistant-tool", ["assistant-tool"], "owner", { registry, hook: "order-detail" }),
    ).toBeNull();
  });
});

describe("toolNavItems", () => {
  it("deja solo lo serializable que el menú necesita", () => {
    expect(toolNavItems([ownerTool])).toEqual([
      { slug: "owner-tool", name: "De dueña", href: "/extensions/owner-tool" },
    ]);
    expect(toolHref("x")).toBe("/extensions/x");
  });
});
