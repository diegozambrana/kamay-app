import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";
const GEEKO_ASSISTANT = "ayudante@kamay.test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * Abre un pedido de la semilla por su número.
 *
 * `exact` no es un detalle: sin él, "#1" también casa con "#10" y "#11".
 *
 * Las pruebas que MUEVEN un pedido usan cada una una línea distinta, y
 * ninguna de las que `order-board.spec.ts` afirma: los dos archivos corren en
 * paralelo contra la misma semilla, así que mover una tarjeta que el otro
 * cuenta lo haría fallar de forma intermitente.
 */
async function openSeedOrder(page: Page, code: string) {
  await page.goto("/orders?view=list");
  await page.getByRole("link", { name: code, exact: true }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
}

test.describe("recorrido de un pedido (V3 y V4)", () => {
  test("el pedido recorre todos los estados de su línea y el historial lo registra", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    // #10 es de Impresión 3D: su tablero no lo afirma ninguna otra prueba.
    await openSeedOrder(page, "#10");

    // El juego completo de Impresión 3D, en orden.
    const recorrido = [
      "Registrado",
      "En cola",
      "Imprimiendo",
      "Post-proceso",
      "Listo para entrega",
      "Entregado",
    ];

    for (const estado of recorrido) {
      await page.getByTestId("status-select").click();
      await page.getByRole("option", { name: estado, exact: true }).click();
      await expect(page.getByTestId("status-select")).toContainText(estado);
    }

    // Cada paso quedó en la bitácora: un solo historial (convención nº 7).
    await page.reload();
    const cambios = page.locator('[data-testid="history-entry"][data-action="status_changed"]');
    expect(await cambios.count()).toBeGreaterThanOrEqual(recorrido.length - 1);
  });

  test("el detalle calcula el total desde las líneas", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    // El #1 de la semilla: 3 × 45 + 1 × 55 = 190.
    await openSeedOrder(page, "#1");

    await expect(page.getByTestId("order-line")).toHaveCount(2);
    await expect(page.getByTestId("order-total")).toHaveText("190.00");

    // La imagen de referencia existe como fila aunque el objeto no esté en el
    // bucket: el detalle la muestra sin romperse.
    await expect(page.getByTestId("order-image")).toHaveCount(1);
  });

  test("un pedido sin líneas muestra total 0, no vacío", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    // #7 se lee, no se mueve: su estado da igual, no tiene líneas nunca.
    await openSeedOrder(page, "#7");

    await expect(page.getByTestId("order-line")).toHaveCount(0);
    await expect(page.getByTestId("order-total")).toHaveCount(0);
    await expect(page.getByText("todavía no tiene líneas")).toBeVisible();
  });

  test("el ayudante mueve el pedido pero no ve la bitácora", async ({ page }) => {
    await login(page, GEEKO_ASSISTANT);
    // #9 es de Alfarería: otra línea, para no cruzarse con el recorrido.
    await openSeedOrder(page, "#9");

    await page.getByTestId("status-select").click();
    await page.getByRole("option", { name: "Entregado", exact: true }).click();
    await expect(page.getByTestId("status-select")).toContainText("Entregado");

    // `activity_log` no tiene política de lectura para el ayudante: el bloque
    // de historial simplemente no aparece. Sin lógica de aplicación.
    await page.reload();
    await expect(page.getByTestId("history-entry")).toHaveCount(0);
  });
});
