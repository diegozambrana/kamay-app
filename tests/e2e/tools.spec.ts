import { agregarDelCatalogo, elegirCliente, guardarYAbrirPedido } from "./helpers/order-form";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

/**
 * KAM-27 · Herramientas por organización, de punta a punta: el catálogo en
 * Configuración, la sección «Herramientas» del menú, la calculadora de
 * impresión 3D en su página y desde un pedido, y lo que el ayudante no ve.
 * Criterios de aceptación 1, 2, 3, 4 y 6 de la tarea.
 *
 * Cada prueba trabaja sobre su propia copia de Geeko Store, que nace sin
 * ninguna herramienta activa.
 */
const PASSWORD = "kamay123";
const SLUG = "print-cost-3d";
const TOOL_PAGE = `/extensions/${SLUG}`;
const TOOL_NAME = "Calculadora de impresión 3D";

async function login(page: Page, email: string) {
  // Nunca por «Cerrar sesión»: ese cierre es global y tumbaría la sesión de la
  // misma cuenta en las pruebas que corren en paralelo.
  await page.context().clearCookies();
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

const card = (page: Page) => page.getByTestId(`tool-${SLUG}`);

async function activate(page: Page) {
  await page.goto("/settings/tools");
  await card(page).getByRole("button", { name: "Activar" }).click();
  await expect(card(page).getByText("Activa", { exact: true })).toBeVisible();
}

async function deactivate(page: Page) {
  await page.goto("/settings/tools");
  await card(page).getByRole("button", { name: "Desactivar" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Tus parámetros se conservan");
  await dialog.getByRole("button", { name: "Desactivar" }).click();
  await expect(card(page).getByText("No activa", { exact: true })).toBeVisible();
}

/** El menú lateral solo existe en escritorio; en el celular la entrada vive en «Más». */
async function expectToolInMenu(page: Page, present: boolean, isMobile: boolean) {
  if (isMobile) {
    await page.getByTestId("bottom-bar-more").click();
    const panel = page.getByTestId("more-panel");
    await expect(panel.getByRole("link", { name: TOOL_NAME })).toHaveCount(present ? 1 : 0);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    return;
  }
  await expect(page.getByTestId("sidebar-tools")).toHaveCount(present ? 1 : 0);
  if (present) {
    await expect(
      page.getByTestId("sidebar-tools").getByRole("link", { name: TOOL_NAME }),
    ).toHaveAttribute("href", TOOL_PAGE);
  }
}

async function expectNotFound(page: Page) {
  await page.goto(TOOL_PAGE);
  await expect(page.getByText("Este registro no existe o no está a tu alcance")).toBeVisible();
}

test.describe("herramientas por organización", () => {
  test("activar, configurar, usar, desactivar y reactivar conservando los parámetros", async ({
    page,
    isMobile,
  }) => {
    const copy = geeko();
    await login(page, copy.owner);

    // ── Sin herramientas activas: está en el catálogo, no en el menú ──────
    await page.goto("/settings/tools");
    await expect(page.getByRole("link", { name: "Herramientas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(card(page).getByRole("heading", { name: TOOL_NAME })).toBeVisible();
    await expect(card(page).getByText("No activa", { exact: true })).toBeVisible();
    await expect(card(page)).toContainText("No sale a internet");
    await expectToolInMenu(page, false, isMobile);
    await expectNotFound(page);

    // ── Activar: aparece en el menú y su página responde ─────────────────
    await activate(page);
    await expectToolInMenu(page, true, isMobile);

    // ── Configurar: una tarifa y un insumo ───────────────────────────────
    await card(page).getByText("Parámetros", { exact: true }).click();
    const form = page.getByTestId(`tool-config-${SLUG}`);
    await form.getByLabel("Precio del filamento (por kilo)").fill("200");
    const extras = form.getByTestId("rows-extras");
    await extras.getByRole("button", { name: "Añadir fila" }).click();
    await extras.getByRole("textbox", { name: "Nombre" }).fill("Llavero");
    await extras.getByRole("textbox", { name: "Costo unitario" }).fill("0,5");
    await form.getByRole("button", { name: "Guardar parámetros" }).click();
    await expect(form.getByRole("status")).toHaveText("Parámetros guardados.");

    // ── Usar: 100 g a 200/kg = 20, más 1 h a 2,75/h = 22,75 de costo ──────
    await page.goto(TOOL_PAGE);
    await expect(page.getByRole("heading", { name: TOOL_NAME })).toBeVisible();
    await expect(page.getByTestId("print-cost-rates")).toContainText("200.00");
    await page.getByLabel("Filamento de la placa (g)").fill("100");
    await page.getByLabel("Horas").fill("1");
    await page.getByLabel(/^Llavero/).fill("1");

    const result = page.getByTestId("print-cost-result");
    await expect(result).toContainText("Costo de producción22.75");
    // 22,75 cae entre las anclas 10 → 250 % y 50 → 175 %: margen 226,1 %.
    await expect(result).toContainText("226,1 %");
    // 22,75 × 2,2609 + 0,50 de llavero = 51,94 → 52 con el redondeo a la unidad.
    await expect(result).toContainText("Precio unitario52.00");

    // ── Desactivar: fuera del menú, página «no encontrada» ───────────────
    await deactivate(page);
    await expectToolInMenu(page, false, isMobile);
    await expectNotFound(page);

    // ── Reactivar: vuelve con lo que la dueña dejó ───────────────────────
    await page.goto("/settings/tools");
    await expect(card(page)).toContainText("vuelve con los parámetros que dejaste");
    await activate(page);
    await card(page).getByText("Parámetros", { exact: true }).click();
    await expect(
      page.getByTestId(`tool-config-${SLUG}`).getByLabel("Precio del filamento (por kilo)"),
    ).toHaveValue("200");
    await expect(
      page.getByTestId("rows-extras").getByRole("textbox", { name: "Nombre" }),
    ).toHaveValue("Llavero");

    // ── El ayudante: ni catálogo, ni menú, ni página ─────────────────────
    await login(page, copy.assistant);
    await page.goto("/settings/tools");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectToolInMenu(page, false, isMobile);
    await expectNotFound(page);

    await page.goto("/settings/notifications");
    await expect(page.getByRole("link", { name: "Herramientas" })).toHaveCount(0);
  });

  test("desde un pedido, la calculadora añade una línea sin tocar las demás", async ({ page }) => {
    await login(page, geeko().owner);
    await activate(page);

    // Un pedido propio: una maceta de 60.
    await page.goto("/orders/new");
    await page.getByTestId("line-select").click();
    await page.getByRole("option", { name: "Alfarería", exact: true }).click();
    await elegirCliente(page, "Colegio San Andrés");
    await agregarDelCatalogo(page, ["Maceta de barro"]);
    await guardarYAbrirPedido(page);
    const orderUrl = page.url();
    await expect(page.getByTestId("order-total")).toHaveText("60.00");
    await expect(page.getByTestId("order-line")).toHaveCount(1);

    // El caso de referencia de la hoja del taller: costo 10,59 → unitario 26.
    await page.getByRole("button", { name: "Calcular impresión 3D" }).click();
    const dialog = page.getByTestId("print-cost-dialog");
    await dialog.getByLabel("Filamento de la placa (g)").fill("143");
    await dialog.getByLabel("Horas").fill("11");
    await dialog.getByLabel("Unidades por placa").fill("6");
    await dialog.getByLabel("Colores").fill("2");

    const line = dialog.getByTestId("print-cost-line");
    await expect(line.getByLabel("Cantidad")).toHaveValue("6");
    await expect(line.getByLabel(/^Precio \(/)).toHaveValue("26.00");
    await line.getByLabel("Descripción").fill("Llavero calavera");
    await dialog.getByRole("button", { name: "Añadir al pedido" }).click();
    await expect(dialog).toHaveCount(0);

    // La línea nueva está, la anterior sigue, y el total sube 6 × 26 = 156.
    await expect(page.getByTestId("order-line")).toHaveCount(2);
    await expect(page.getByTestId("order-line").filter({ hasText: "Llavero calavera" })).toHaveCount(1);
    await expect(page.getByTestId("order-line").filter({ hasText: "Maceta de barro" })).toHaveCount(1);
    await expect(page.getByTestId("order-total")).toHaveText("216.00");

    // Desactivada, el detalle del pedido deja de ofrecerla; la línea se queda.
    await deactivate(page);
    await page.goto(orderUrl);
    await expect(page.getByTestId("edit-order")).toBeVisible();
    await expect(page.getByRole("button", { name: "Calcular impresión 3D" })).toHaveCount(0);
    await expect(page.getByTestId("order-line")).toHaveCount(2);
  });
});
