import { beforeAll, describe, expect, it } from "vitest";

import { OrganizationToolService } from "@/services/tools/organization-tool-service";
import { printCost3d } from "@/tools/print-cost-3d/manifest";
import { readConfig } from "@/tools/print-cost-3d/schema";
import { activeToolsFor } from "@/tools/resolve";

import { loggedActions, seedWorkshop, type Workshop } from "./tools-support";

/**
 * KAM-27 · El recorrido completo de una herramienta contra la base real (spec
 * `tenant-tools` → *La activación de herramientas se guarda por organización*,
 * *Solo la dueña lee y escribe la activación* y *Activar, desactivar y cambiar
 * parámetros queda en la bitácora*).
 *
 * pgTAP ya prueba las políticas una a una; aquí se prueba que el **servicio**
 * —lo que la aplicación usa de verdad— recorre activar → configurar →
 * desactivar → reactivar sin perder los parámetros, y que dos organizaciones
 * no se ven.
 */
const TIMEOUT = 60_000;
const SLUG = printCost3d.slug;

let a: Workshop;
let b: Workshop;

beforeAll(async () => {
  [a, b] = await Promise.all([seedWorkshop("Herramientas A"), seedWorkshop("Herramientas B")]);
}, TIMEOUT);

describe("ciclo de vida de una herramienta", { timeout: TIMEOUT }, () => {
  it("activar → configurar → desactivar → reactivar conserva los parámetros", async () => {
    const tools = new OrganizationToolService(a.owner);
    const defaults = printCost3d.defaults as Record<string, unknown>;

    // Organización recién creada: nada activo.
    expect(await tools.activeSlugs(a.organizationId)).toEqual([]);

    // Activar por primera vez: nace con los valores por defecto del manifiesto.
    await tools.activate(a.organizationId, SLUG, defaults);
    expect(await tools.activeSlugs(a.organizationId)).toEqual([SLUG]);
    expect(await tools.getActiveConfig(a.organizationId, SLUG)).toEqual(defaults);

    // Configurar: una tarifa y un insumo.
    const edited = {
      ...defaults,
      filamentPricePerKg: 190,
      extras: [{ name: "Llavero", cost: 0.5 }],
    };
    await tools.updateConfig(a.organizationId, SLUG, edited);

    // Desactivar: deja de figurar, y la página ya no recibe parámetros.
    await tools.deactivate(a.organizationId, SLUG);
    expect(await tools.activeSlugs(a.organizationId)).toEqual([]);
    expect(await tools.getActiveConfig(a.organizationId, SLUG)).toBeNull();
    expect((await tools.findBySlug(a.organizationId, SLUG))?.config).toEqual(edited);

    // Reactivar: vuelve con lo que la dueña dejó, no con los valores por defecto.
    await tools.activate(a.organizationId, SLUG, defaults);
    const restored = await tools.getActiveConfig(a.organizationId, SLUG);
    expect(restored).toEqual(edited);
    expect(readConfig(restored)?.filamentPricePerKg).toBe(190);

    // Una sola fila en todo el recorrido.
    expect(await tools.list(a.organizationId)).toHaveLength(1);

    // Y cada paso quedó en la bitácora, con su acción.
    expect(await loggedActions(a.owner, a.organizationId, "organization_tools")).toEqual([
      "created",
      "updated",
      "archived",
      "unarchived",
    ]);
  });

  it("el ayudante sabe qué está activo, pero no con qué parámetros", async () => {
    const asAssistant = new OrganizationToolService(a.assistant);

    expect(await asAssistant.activeSlugs(a.organizationId)).toEqual([SLUG]);
    expect(await asAssistant.list(a.organizationId)).toEqual([]);
    expect(await asAssistant.getActiveConfig(a.organizationId, SLUG)).toBeNull();

    // La calculadora es de dueña: aun activa, el ayudante no la tiene en el menú.
    expect(activeToolsFor([SLUG], "assistant")).toEqual([]);
    expect(activeToolsFor([SLUG], "owner").map((tool) => tool.slug)).toEqual([SLUG]);
  });

  it("el ayudante no activa, no configura y no desactiva", async () => {
    const asAssistant = new OrganizationToolService(a.assistant);
    const before = await new OrganizationToolService(a.owner).findBySlug(a.organizationId, SLUG);

    await expect(asAssistant.updateConfig(a.organizationId, SLUG, { hack: true })).rejects.toThrow();
    await expect(asAssistant.deactivate(a.organizationId, SLUG)).rejects.toThrow();
    await expect(asAssistant.activate(a.organizationId, "otra", {})).rejects.toThrow();

    expect(await new OrganizationToolService(a.owner).findBySlug(a.organizationId, SLUG)).toEqual(
      before,
    );
  });

  it("dos organizaciones no se ven", async () => {
    const fromB = new OrganizationToolService(b.owner);

    // B no tiene nada activo, y preguntando por A obtiene cero: ni filas ni slugs.
    expect(await fromB.activeSlugs(b.organizationId)).toEqual([]);
    expect(await fromB.activeSlugs(a.organizationId)).toEqual([]);
    expect(await fromB.list(a.organizationId)).toEqual([]);
    expect(await fromB.getActiveConfig(a.organizationId, SLUG)).toBeNull();
    await expect(fromB.deactivate(a.organizationId, SLUG)).rejects.toThrow();

    // A sigue activa e intacta.
    expect(await new OrganizationToolService(a.owner).activeSlugs(a.organizationId)).toEqual([SLUG]);
  });

  it("una herramienta retirada del registro se ignora sin romper nada", async () => {
    const tools = new OrganizationToolService(b.owner);
    await tools.activate(b.organizationId, "herramienta-retirada", {});

    const slugs = await tools.activeSlugs(b.organizationId);
    expect(slugs).toEqual(["herramienta-retirada"]);
    expect(activeToolsFor(slugs, "owner")).toEqual([]);
  });
});
