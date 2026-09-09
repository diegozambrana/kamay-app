import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";

/** La prensa de tazas de la semilla: Sublimación, 900 de costo, 120 de mantenimiento. */
const PRENSA = "Prensa de tazas";
/** La impresora: Impresión 3D, línea sin cobros — su barra está en 0 %. */
const IMPRESORA = "Impresora 3D Ender";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * Abre el detalle de un ítem del catálogo desde su menú de acciones: las filas
 * no navegan al hacer clic, la fila ofrece *Ver*.
 */
async function openItem(page: Page, nombre: string) {
  const fila = page.getByTestId("catalog-row").filter({ hasText: nombre });
  await fila.getByRole("button", { name: "Acciones" }).click();
  await page.getByRole("menuitem", { name: "Ver" }).click();
  await page.waitForURL(/\/catalog\/[0-9a-f-]+$/);
}

function card(page: Page, name: string) {
  return page.getByTestId("asset-card").filter({ hasText: name });
}

/**
 * V12 · Activos, de extremo a extremo. Cubre los requisitos "Pantalla de
 * activos (V12)", "Detalle del activo en panel", "Alta de un activo desde el
 * catálogo" y "Vinculación de gastos de mantenimiento a un activo" del delta
 * spec `assets`.
 */
test.describe("V12 · activos y recuperación de inversión", () => {
  test("la lista muestra costo, mantenimiento y barra de cada máquina", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/assets");

    const prensa = card(page, PRENSA);
    await expect(prensa).toBeVisible();
    // Costo declarado 900 + 120 de mantenimiento = 1020 de costo total.
    await expect(prensa.getByTestId("asset-total-cost")).toHaveText("1020.00");
    await expect(prensa.getByTestId("asset-maintenance")).toHaveText("120.00");

    /*
     * El porcentaje se comprueba como porcentaje, no como cifra fija: el
     * margen de Sublimación se mueve con cualquier cobro que otra suite
     * registre en esa línea, y la aritmética exacta ya la vigilan
     * `asset_recovery.test.sql` y `lib/assets/recovery.test.ts`. Lo que esta
     * prueba defiende es que la pantalla lo muestra.
     */
    const porcentaje = Number(
      await prensa.getByTestId("recovery-bar").getAttribute("data-percent"),
    );
    expect(porcentaje).toBeGreaterThanOrEqual(0);
    expect(porcentaje).toBeLessThanOrEqual(100);
  });

  test("una línea que aún no genera margen muestra 0 % sin errores", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/assets");

    await expect(card(page, IMPRESORA).getByTestId("recovery-bar")).toHaveAttribute(
      "data-percent",
      "0",
    );
  });

  test("el detalle muestra sus egresos y el desglose del costo", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/assets");
    await card(page, PRENSA).click();

    await expect(page.getByTestId("detail-total-cost")).toHaveText("1020.00");
    // La compra vinculada como adquisición y el mantenimiento, cada uno con su
    // importe y su enlace a la bandeja de egresos.
    const gastos = page.getByTestId("asset-expense");
    await expect(gastos).toHaveCount(2);
    await expect(gastos.filter({ hasText: "120.00" })).toBeVisible();
    await expect(gastos.filter({ hasText: "900.00" })).toBeVisible();
  });

  test("un gasto vinculado sube el costo del activo y la barra retrocede", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    /*
     * Este caso escribe, así que se hace su propio activo en vez de tocar la
     * prensa de la semilla: la base local se comparte entre corridas y entre
     * suites, y mutar un dato sembrado dejaría a los casos de lectura
     * midiendo cifras distintas en la segunda vuelta.
     *
     * Se declara en Sublimación y con la misma antigüedad que la prensa, para
     * que herede el mismo margen de línea y su barra tenga algo que mostrar.
     */
    const nombre = `Prensa de prueba ${Date.now()}`;
    const MONTO = `1${String(Date.now()).slice(-4)}.50`;

    await page.goto("/catalog?kind=asset");
    await page.getByRole("button", { name: "Nuevo ítem" }).click();
    await page.getByLabel("Nombre").fill(nombre);
    await page.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "Activo" }).click();
    await page.getByRole("combobox", { name: "Línea" }).click();
    await page.getByRole("option", { name: "Sublimación", exact: true }).click();
    await page.getByRole("button", { name: "Crear ítem" }).click();

    await openItem(page, nombre);
    await page.getByLabel("Costo de adquisición").fill("1000");
    await page.getByLabel("Fecha de compra").fill("2026-01-15");
    await page.getByRole("button", { name: "Declarar activo" }).click();
    // El formulario pasa a "Guardar cambios" cuando el activo ya está
    // declarado: es la señal de que el servidor terminó y revalidó.
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();

    await page.goto("/assets");
    const activo = card(page, nombre);
    await expect(activo.getByTestId("asset-total-cost")).toHaveText("1000.00");
    const antes = Number(await activo.getByTestId("recovery-bar").getAttribute("data-percent"));
    expect(antes).toBeGreaterThan(0);

    // Un gasto de la misma línea, todavía sin dueño.
    await page.goto("/expenses/costs/new");
    await page.getByLabel("Monto").fill(MONTO);
    await page.getByTestId("category-chip").filter({ hasText: "Herramientas" }).click();
    await page.getByTestId("line-select").click();
    await page.getByRole("option", { name: "Sublimación" }).click();
    await page.getByTestId("save-cost").click();
    await page.waitForURL(/\/expenses/);

    await page
      .getByTestId(/^expense-(row|card)$/)
      .filter({ hasText: MONTO })
      .first()
      .click();

    await page.getByTestId("asset-link-select").click();
    await page.getByRole("option", { name: nombre }).click();
    // El vínculo ya está guardado cuando el detalle ofrece deshacerlo.
    await expect(page.getByRole("button", { name: "Desvincular" })).toBeVisible();

    await page.goto("/assets");
    // El costo total sube justo lo que costó el mantenimiento, y la barra
    // retrocede porque el denominador creció sin que el margen se moviera.
    await expect(card(page, nombre).getByTestId("asset-total-cost")).toHaveText(
      (1000 + Number(MONTO)).toFixed(2),
    );
    const despues = Number(
      await card(page, nombre).getByTestId("recovery-bar").getAttribute("data-percent"),
    );
    expect(despues).toBeLessThan(antes);
  });

  test("un activo se declara desde el detalle de su ítem en el catálogo", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    // Un ítem de tipo activo nuevo, sin datos declarados todavía.
    const nombre = `Guillotina ${Date.now()}`;
    await page.goto("/catalog?kind=asset");
    await page.getByRole("button", { name: "Nuevo ítem" }).click();
    await page.getByLabel("Nombre").fill(nombre);
    await page.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "Activo" }).click();
    await page.getByRole("button", { name: "Crear ítem" }).click();

    await openItem(page, nombre);

    // Los datos que KAM-06 aplazó: llegan aquí.
    await expect(page.getByTestId("asset-details-section")).toBeVisible();
    await page.getByLabel("Costo de adquisición").fill("500");
    await page.getByLabel("Fecha de compra").fill("2026-01-15");
    await page.getByRole("button", { name: "Declarar activo" }).click();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();

    await page.goto("/assets");
    await expect(card(page, nombre)).toBeVisible();
  });
});
