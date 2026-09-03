import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";
const GEEKO_ASSISTANT = "ayudante@kamay.test";

const ORDER_DETAIL = /\/orders\/[0-9a-f]{8}-[0-9a-f-]+$/;

async function login(page: Page, email: string) {
  // Se limpian las cookies primero porque una de estas pruebas cambia de
  // usuario a mitad: con sesión abierta, `/auth/login` redirige y el
  // formulario no llega a aparecer.
  await page.context().clearCookies();
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * Cada prueba crea su propio pedido en vez de tocar los de la semilla: las de
 * KAM-07 afirman los suyos por número, y editarlos las volvería
 * intermitentes. Devuelve la dirección del pedido creado.
 */
async function crearPedido(
  page: Page,
  { linea = "Alfarería", producto = "Maceta de barro", cliente = "Colegio San Andrés" } = {},
): Promise<string> {
  await page.goto("/orders/new");

  await page.getByTestId("line-select").click();
  await page.getByRole("option", { name: linea, exact: true }).click();

  await page.getByLabel("Cliente").fill(cliente);
  await page.getByRole("button", { name: cliente, exact: true }).click();

  await page.getByLabel("Agregar del catálogo").fill(producto);
  await page.getByRole("button", { name: new RegExp(producto) }).click();

  await page.getByTestId("save-order").click();
  await page.waitForURL(ORDER_DETAIL);

  return new URL(page.url()).pathname;
}

test.describe("edición de pedidos (V5 sobre V4)", () => {
  test("editar cambia la fecha y agrega una línea", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    const pedido = await crearPedido(page);

    await expect(page.getByTestId("order-total")).toHaveText("60.00");

    await page.getByTestId("edit-order").click();
    await page.waitForURL(/\/edit$/);

    await page.getByRole("button", { name: "En una semana" }).click();

    // Una línea libre de 2 × 60 = 120, para un total de 180.
    await page.getByRole("button", { name: /Línea libre/ }).click();
    const filas = page.getByTestId("order-line-row");
    await filas.nth(1).getByLabel("Cantidad").fill("2");
    await filas.nth(1).getByLabel("Precio").fill("60");
    await filas.nth(1).getByLabel("Descripción").fill("Pieza a medida según plano");

    await expect(page.getByTestId("order-form-total")).toHaveText("180.00");

    await page.getByTestId("save-order").click();
    await page.waitForURL(ORDER_DETAIL);

    await expect(page.getByTestId("order-line")).toHaveCount(2);
    await expect(page.getByTestId("order-total")).toHaveText("180.00");
    await expect(page.getByText("Pieza a medida según plano")).toBeVisible();

    // Quitar la línea la retira del pedido sin borrarla.
    await page.goto(`${pedido}/edit`);
    await page.getByRole("button", { name: "Quitar línea libre" }).click();
    await expect(page.getByTestId("order-form-total")).toHaveText("60.00");

    await page.getByTestId("save-order").click();
    await page.waitForURL(ORDER_DETAIL);

    await expect(page.getByTestId("order-line")).toHaveCount(1);
    await expect(page.getByTestId("order-total")).toHaveText("60.00");
    await expect(page.getByText("Pieza a medida según plano")).toHaveCount(0);
  });

  test("la línea de negocio se muestra pero no se cambia", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await crearPedido(page);

    await page.getByTestId("edit-order").click();
    await page.waitForURL(/\/edit$/);

    await expect(page.getByTestId("line-label")).toContainText("Alfarería");
    await expect(page.getByTestId("line-select")).toHaveCount(0);
  });

  test("no se puede dejar el pedido sin líneas", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await crearPedido(page);

    await page.getByTestId("edit-order").click();
    await page.waitForURL(/\/edit$/);

    await page.getByRole("button", { name: /^Quitar/ }).click();
    await page.getByTestId("save-order").click();

    await expect(page.getByTestId("lines-error")).toContainText(
      "Agrega al menos una línea",
    );
    await expect(page).toHaveURL(/\/edit$/);
  });

  /** Matriz de acceso §16: el ayudante edita pedidos y sus líneas. */
  test("el ayudante edita la nota y la cantidad, y queda en la bitácora", async ({
    page,
  }) => {
    await login(page, GEEKO_ASSISTANT);
    const pedido = await crearPedido(page);

    await page.getByTestId("edit-order").click();
    await page.waitForURL(/\/edit$/);

    await page.getByLabel("Cantidad").fill("4");
    await page.getByLabel("Nota").fill("Lo pasa a recoger el lunes.");

    await page.getByTestId("save-order").click();
    await page.waitForURL(ORDER_DETAIL);

    await expect(page.getByTestId("order-total")).toHaveText("240.00");
    await expect(page.getByText("Lo pasa a recoger el lunes.")).toBeVisible();

    // La bitácora solo la lee el dueño: se comprueba con su sesión.
    await login(page, GEEKO_OWNER);
    await page.goto(pedido);
    await expect(
      page.locator('[data-testid="history-entry"][data-action="updated"]'),
    ).toHaveCount(1);
  });
});

test.describe("cancelación de pedidos (V4)", () => {
  test("cancelar mueve el pedido al estado de cancelación de su línea", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await crearPedido(page);

    await expect(page.getByTestId("status-select")).toContainText("Reservado");

    // Rechazar la confirmación no cambia nada.
    await page.getByTestId("cancel-order").click();
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page.getByTestId("status-select")).toContainText("Reservado");

    await page.getByTestId("cancel-order").click();
    await page.getByTestId("confirm-cancel-order").click();

    await expect(page.getByTestId("status-select")).toContainText("Cancelado");
    // Cancelar no archiva: el pedido sigue a la vista y con su historia.
    await expect(
      page.locator('[data-testid="history-entry"][data-action="status_changed"]'),
    ).toHaveCount(1);

    // Ya cancelado, la acción deja de ofrecerse.
    await expect(page.getByTestId("cancel-order")).toHaveCount(0);
    // Y sigue siendo editable: cancelado no es archivado.
    await expect(page.getByTestId("edit-order")).toBeVisible();
  });

  test("un pedido archivado no ofrece editar ni cancelar", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    // El pedido archivado de la semilla (#11): se lee, no se toca, así que
    // no hace falta crear uno propio.
    await page.goto("/orders?view=list&archived=1");
    await page.getByRole("link", { name: "#11", exact: true }).click();
    await page.waitForURL(ORDER_DETAIL);

    await expect(page.getByText("Archivado", { exact: true })).toBeVisible();
    await expect(page.getByTestId("edit-order")).toHaveCount(0);
    await expect(page.getByTestId("cancel-order")).toHaveCount(0);

    // Y entrar por dirección directa a su edición tampoco deja guardar.
    await page.goto(`${new URL(page.url()).pathname}/edit`);
    await expect(page.getByText("Un pedido archivado no se edita")).toBeVisible();
    await expect(page.getByTestId("save-order")).toHaveCount(0);
  });
});
