import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";

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
 * `exact` no es un detalle: sin él, "#5" también casaría con "#50".
 */
async function openSeedOrder(page: Page, code: string) {
  await page.goto("/orders?view=list");
  await page.getByRole("link", { name: code, exact: true }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
}

/**
 * El pedido #5 de la semilla (12 × 45 = 540) es el único que esta prueba
 * toca: ninguna otra suite afirma su estado ni su dinero, y todas corren en
 * paralelo contra la misma semilla.
 */
const ORDER = "#5";
const TOTAL = "540.00";

// En serie y en un solo proyecto: estas pruebas MUEVEN el dinero del pedido
// #5 y la semilla es compartida, así que dos proyectos corriéndolas a la vez
// se pisarían. Mismo motivo —y misma solución— que el bloque en serie de
// `order-board.spec.ts`. El diálogo no tiene camino propio en móvil: es el
// mismo componente y las pruebas de componente ya lo cubren.
test.describe.serial("cobros y saldo de un pedido (V4)", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "la semilla del dinero es compartida");

  test("anticipo, saldo, cobro final y anulación", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await openSeedOrder(page, ORDER);

    // ── Punto de partida: sin cobros, el saldo es el total ────────────────
    await expect(page.getByTestId("payment-total")).toHaveText(TOTAL);
    await expect(page.getByTestId("payment-balance")).toHaveText(TOTAL);
    await expect(page.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "pending",
    );

    // ── Anticipo de 200 ───────────────────────────────────────────────────
    await page.getByTestId("register-payment").click();
    const monto = page.getByLabel("Monto");
    // El diálogo propone el saldo pendiente: cobrar lo que falta es un toque.
    await expect(monto).toHaveValue("540.00");
    await monto.fill("200");
    await page.getByTestId("payment-submit").click();

    await expect(page.getByTestId("payment-balance")).toHaveText("340.00");
    await expect(page.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "partial",
    );

    // El saldo sobrevive a la recarga: sale de la vista, no de un store.
    await page.reload();
    await expect(page.getByTestId("payment-paid")).toHaveText("200.00");
    await expect(page.getByTestId("payment-balance")).toHaveText("340.00");
    await expect(page.getByTestId("payment-entry")).toHaveCount(1);

    // Scenario: El cobro queda en la bitácora.
    await expect(
      page.getByTestId("history-entry").filter({ hasText: "Registrado" }).first(),
    ).toBeVisible();

    // ── Cobro final del saldo ─────────────────────────────────────────────
    await page.getByTestId("register-payment").click();
    await expect(page.getByLabel("Monto")).toHaveValue("340.00");
    await page.getByTestId("payment-submit").click();

    await expect(page.getByTestId("payment-balance")).toHaveText("0.00");
    await expect(page.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "paid",
    );

    // ── Anulación: el saldo vuelve, el movimiento no se borra ─────────────
    await page.reload();
    await expect(page.getByTestId("payment-entry")).toHaveCount(2);

    // Se anula el cobro de 340 por su importe, no por su posición: los dos
    // cobros caen en el mismo minuto y la lista los ordena por la hora del
    // servidor, que la prueba no controla.
    await page
      .getByTestId("payment-entry")
      .filter({ hasText: "340.00" })
      .getByTestId("void-payment")
      .click();
    await page.getByTestId("confirm-void").click();

    await expect(page.getByTestId("payment-balance")).toHaveText("340.00");

    await page.reload();
    // Scenario: Ambos hechos quedan registrados — el anulado sigue en la
    // lista, tachado, y no cuenta en el saldo.
    await expect(page.getByTestId("payment-entry")).toHaveCount(2);
    await expect(
      page.getByTestId("payment-entry").filter({ hasText: "Anulado" }),
    ).toHaveCount(1);
    await expect(page.getByTestId("payment-paid")).toHaveText("200.00");
    await expect(page.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "partial",
    );

    // Scenario: Corrección por la vía prevista — se vuelve a registrar el
    // importe correcto y el saldo refleja solo lo vigente.
    await page.getByTestId("register-payment").click();
    await page.getByLabel("Monto").fill("340");
    await page.getByTestId("payment-submit").click();

    await expect(page.getByTestId("payment-balance")).toHaveText("0.00");
    await page.reload();
    await expect(page.getByTestId("payment-entry")).toHaveCount(3);
    await expect(page.getByTestId("payment-paid")).toHaveText("540.00");
  });

  test("el sobrepago se advierte pero se permite", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    // #5 quedó saldado por la prueba anterior (serial): cualquier cobro
    // adicional es, por definición, un sobrepago.
    await openSeedOrder(page, ORDER);

    await page.getByTestId("register-payment").click();
    await page.getByLabel("Monto").fill("50");

    // Se advierte del excedente…
    await expect(page.getByTestId("overpayment-warning")).toContainText("50.00");
    // …y aun así se puede confirmar.
    await page.getByTestId("payment-submit").click();

    await expect(page.getByTestId("payment-balance")).toHaveText("-50.00");
    await expect(page.getByTestId("payment-status")).toHaveAttribute(
      "data-status",
      "overpaid",
    );
  });
});
