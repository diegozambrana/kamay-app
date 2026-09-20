import { geeko } from "./helpers/seed-copies";
import {
  ORDER_DETAIL,
  agregarDelCatalogo,
  elegirCliente,
  guardarYAbrirPedido,
} from "./helpers/order-form";
import { expect, test, type Page } from "./helpers/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";

/** La edición; al llegar desde el detalle trae `?from=` (spec `navigation-breadcrumbs`). */
const EDIT = /\/edit(\?.*)?$/;

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
  opciones: { linea?: string; producto?: string; cliente?: string } = {},
): Promise<string> {
  return (await crearPedidoYCodigo(page, opciones)).path;
}

/** Como `crearPedido`, y además el número visible del pedido. */
async function crearPedidoYCodigo(
  page: Page,
  { linea = "Alfarería", producto = "Maceta de barro", cliente = "Colegio San Andrés" } = {},
): Promise<{ path: string; code: string }> {
  await page.goto("/orders/new");

  await page.getByTestId("line-select").click();
  await page.getByRole("option", { name: linea, exact: true }).click();

  await elegirCliente(page, cliente);
  await agregarDelCatalogo(page, [producto]);

  const code = await guardarYAbrirPedido(page);

  return { path: new URL(page.url()).pathname, code };
}

test.describe("edición de pedidos (V5 sobre V4)", () => {
  test("editar cambia la fecha y agrega una línea", async ({ page }) => {
    await login(page, geeko().owner);
    const pedido = await crearPedido(page);

    await expect(page.getByTestId("order-total")).toHaveText("60.00");

    await page.getByTestId("edit-order").click();
    await page.waitForURL(EDIT);

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
    await login(page, geeko().owner);
    await crearPedido(page);

    await page.getByTestId("edit-order").click();
    await page.waitForURL(EDIT);

    await expect(page.getByTestId("line-label")).toContainText("Alfarería");
    await expect(page.getByTestId("line-select")).toHaveCount(0);
  });

  test("no se puede dejar el pedido sin líneas", async ({ page }) => {
    await login(page, geeko().owner);
    await crearPedido(page);

    await page.getByTestId("edit-order").click();
    await page.waitForURL(EDIT);

    await page.getByRole("button", { name: "Quitar Maceta de barro" }).click();
    await page.getByTestId("save-order").click();

    await expect(page.getByTestId("lines-error")).toContainText(
      "Agrega al menos una línea",
    );
    await expect(page).toHaveURL(EDIT);
  });

  /** Matriz de acceso §16: el ayudante edita pedidos y sus líneas. */
  test("el ayudante edita la nota y la cantidad, y queda en la bitácora", async ({
    page,
  }) => {
    await login(page, geeko().assistant);
    const pedido = await crearPedido(page);

    await page.getByTestId("edit-order").click();
    await page.waitForURL(EDIT);

    await page.getByLabel("Cantidad").fill("4");
    await page.getByLabel("Nota").fill("Lo pasa a recoger el lunes.");

    await page.getByTestId("save-order").click();
    await page.waitForURL(ORDER_DETAIL);

    await expect(page.getByTestId("order-total")).toHaveText("240.00");
    await expect(page.getByText("Lo pasa a recoger el lunes.")).toBeVisible();

    // La bitácora solo la lee el dueño: se comprueba con su sesión.
    await login(page, geeko().owner);
    await page.goto(pedido);
    await expect(
      page.locator('[data-testid="history-entry"][data-action="updated"]'),
    ).toHaveCount(1);
  });
});

/** Spec `navigation-breadcrumbs` — «Edición vuelve al detalle o a la lista». */
test.describe("migas de pan del pedido", () => {
  test("de la edición al detalle y a la lista, conservando la vista", async ({ page }) => {
    await login(page, geeko().owner);
    const code = (await crearPedidoYCodigo(page)).code;

    // Se entra desde la lista con «Ver archivados»: la vista de origen debe
    // sobrevivir al paso por el detalle y la edición.
    await page.goto("/orders?view=list&archived=1");
    await page.getByRole("link", { name: `#${code}`, exact: true }).click();
    await page.waitForURL(ORDER_DETAIL);
    await page.getByTestId("edit-order").click();
    await page.waitForURL(EDIT);

    const migas = page.getByRole("navigation", { name: "Ruta" });
    await expect(migas).toContainText("Pedidos");
    await expect(migas).toContainText(`Pedido #${code}`);
    await expect(migas).toContainText("Editar");

    await migas.getByRole("link", { name: `Pedido #${code}` }).click();
    await page.waitForURL(ORDER_DETAIL);
    await expect(page.getByTestId("edit-order")).toBeVisible();

    await page.getByRole("navigation", { name: "Ruta" }).getByRole("link", { name: "Pedidos" }).click();
    await page.waitForURL(/\/orders\?view=list&archived=1$/);
  });
});

test.describe("cancelación de pedidos (V4)", () => {
  test("cancelar mueve el pedido al estado de cancelación de su línea", async ({
    page,
  }) => {
    await login(page, geeko().owner);
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
    await login(page, geeko().owner);

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
