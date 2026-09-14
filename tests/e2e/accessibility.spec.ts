import AxeBuilder from "@axe-core/playwright";

import { E2E_PASSWORD, SEED_PLATFORM_ADMIN } from "./helpers/fresh-org";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";


async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * Audita la página tal como está y falla ante cualquier violación crítica o
 * seria, nombrando la regla y los elementos. Lo moderado y lo menor se deja
 * en el informe sin bloquear: el objetivo declarado es «sin fallos críticos»
 * (KAM-23, supuesto 9 de la propuesta).
 *
 * Se audita el nivel AA de WCAG 2.1, que es el que mide el contraste.
 */
async function audit(page: Page, where: string) {
  expect(await violations(page), `violaciones críticas o serias en ${where}`).toEqual([]);
}

/** Las violaciones críticas o serias de la página, legibles. */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // El `DragOverlay` de dnd-kit y los segmentos que React deja ocultos al
    // revelar un límite de Suspense no son parte de la página visible.
    .exclude('div[hidden][id^="S:"]')
    .analyze();

  return results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n    ` +
        violation.nodes
          .map((node) => `${node.target.join(" ")} — ${node.failureSummary?.split("\n")[1]?.trim() ?? ""}`)
          .join("\n    "),
    );
}

/**
 * KAM-23 · Auditoría de accesibilidad (spec `accessibility`).
 *
 * Escenarios: *The accessibility audit runs automatically and reports no
 * critical failures* → «The audited surface covers the main views», «A
 * critical violation breaks the build»; *Text and interactive elements meet
 * contrast thresholds* → «Contrast holds in both themes».
 *
 * Corre en los dos proyectos —escritorio y móvil— y en los dos temas.
 */
const VIEWS: { path: string; name: string }[] = [
  { path: "/dashboard", name: "Panel" },
  { path: "/orders?view=list", name: "Pedidos · lista" },
  { path: "/orders/new", name: "Alta de pedido" },
  { path: "/tasks?view=list", name: "Tareas · lista" },
  { path: "/my-tasks", name: "Mis pendientes" },
  { path: "/expenses", name: "Egresos" },
  { path: "/catalog?kind=supply", name: "Catálogo" },
  { path: "/contacts", name: "Contactos" },
  { path: "/assets", name: "Activos" },
  { path: "/reports", name: "Reportes" },
  { path: "/activity", name: "Bitácora" },
  { path: "/settings/lines", name: "Configuración · líneas" },
  { path: "/quick", name: "Registro rápido" },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`auditoría de accesibilidad · tema ${scheme === "light" ? "claro" : "oscuro"}`, () => {
    test.beforeEach(async ({ page }) => {
      // El tema por omisión es «sistema»: emular la preferencia del sistema
      // lo cambia sin tocar la interfaz.
      await page.emulateMedia({ colorScheme: scheme });
      await login(page, geeko().owner);
    });

    test("las vistas principales no tienen fallos críticos", async ({ page }) => {
      test.setTimeout(120_000);
      // Se auditan todas y se falla al final: una sola vuelta dice todo lo
      // que hay que corregir, no solo lo de la primera vista.
      const found: Record<string, string[]> = {};
      for (const view of VIEWS) {
        await page.goto(view.path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const blocking = await violations(page);
        if (blocking.length > 0) found[view.name] = blocking;
      }
      expect(found, "violaciones críticas o serias por vista").toEqual({});
    });

    test("el tablero de pedidos con datos", async ({ page, isMobile }) => {
      test.skip(isMobile, "el tablero es de escritorio; en móvil la lista es la vista");
      await page.goto("/orders?view=board");
      await page.getByTestId("line-selector").click();
      await page.getByRole("menuitem", { name: "Sublimación" }).click();
      await expect(page.getByTestId("board-column").first()).toBeVisible();
      await audit(page, "Pedidos · tablero");
    });

    test("un formulario con errores de validación", async ({ page }) => {
      await page.goto("/expenses/costs/new");
      await page.getByRole("button", { name: /Guardar/ }).first().click();
      await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
      await audit(page, "Nuevo gasto con errores");
    });

    test("un diálogo abierto", async ({ page }) => {
      await page.goto("/catalog?kind=supply");
      await page.getByRole("button", { name: "Nuevo ítem" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      // Se mide el diálogo ya abierto, no a mitad de su animación de entrada:
      // con la opacidad aún subiendo, el contraste sale más bajo que el real.
      await page.waitForFunction(() =>
        document.getAnimations().every((animation) => animation.playState !== "running"),
      );
      await audit(page, "Catálogo · diálogo de alta");
    });

    test("el modo feria", async ({ page }) => {
      await page.goto("/fair");
      await expect(page.getByTestId("fair-exit")).toBeVisible();
      await audit(page, "Modo feria");
    });
  });
}

/**
 * KAM-26 · Las vistas de plataforma también se auditan, con el super admin de
 * la semilla y en los dos temas.
 */
test.describe("auditoría de accesibilidad · vistas de plataforma", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`Organizaciones y Usuarios · tema ${scheme === "light" ? "claro" : "oscuro"}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/auth/login");
      await page.getByLabel("Correo electrónico").fill(SEED_PLATFORM_ADMIN);
      await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
      await page.getByRole("button", { name: "Entrar" }).click();
      await page.waitForURL(/\/admin\/organizations$/);

      const found: Record<string, string[]> = {};
      for (const view of [
        { path: "/admin/organizations", name: "Organizaciones" },
        { path: "/admin/users", name: "Usuarios" },
      ]) {
        await page.goto(view.path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const blocking = await violations(page);
        if (blocking.length > 0) found[view.name] = blocking;
      }
      expect(found, "violaciones críticas o serias por vista").toEqual({});
    });
  }
});

/**
 * Spec `accessibility` → *Every action is reachable by keyboard*: «A dialog
 * traps and returns focus», «A record can be created without a pointer»;
 * *Focus is always visible* → «Tabbing reveals focus on every control».
 */
test.describe("solo con teclado", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "el teclado físico es de escritorio");

  test("un diálogo atrapa el foco, se cierra con Escape y lo devuelve", async ({ page }) => {
    await login(page, geeko().owner);
    await page.goto("/catalog?kind=supply");

    const opener = page.getByRole("button", { name: "Nuevo ítem" });
    await opener.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Recorrer más controles de los que tiene el diálogo no saca el foco.
    for (let step = 0; step < 15; step += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("un contacto se crea sin tocar el puntero", async ({ page }) => {
    await login(page, geeko().owner);
    await page.goto("/contacts");

    const name = `Teclado ${Date.now()}`;
    await page.getByRole("button", { name: "Nuevo contacto" }).focus();
    await page.keyboard.press("Enter");

    const form = page.getByTestId("contact-form");
    await form.getByLabel("Nombre").focus();
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("contact-row").filter({ hasText: name })).toHaveCount(1);
  });

  test("todo control que recibe el foco lo muestra", async ({ page }) => {
    await login(page, geeko().owner);
    await page.goto("/orders/new");

    // Se recorre el formulario con el tabulador y, en cada parada, el control
    // enfocado tiene que distinguirse de su reposo: anillo, contorno o sombra.
    for (let step = 0; step < 20; step += 1) {
      await page.keyboard.press("Tab");
      const visible = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body) return true;
        const style = getComputedStyle(active);
        const ring = style.boxShadow !== "none" && style.boxShadow !== "";
        const outline = style.outlineStyle !== "none" && style.outlineWidth !== "0px";
        return ring || outline;
      });
      expect(visible, `el control n.º ${step + 1} no muestra el foco`).toBe(true);
    }
  });
});
