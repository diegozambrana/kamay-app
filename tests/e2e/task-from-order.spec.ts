import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

async function selectLine(page: Page, name: string) {
  await page.getByTestId("line-selector").click();
  await page.getByRole("menuitem", { name }).click();
  await expect(page.getByTestId("line-selector")).toContainText(name);
  await expect(page.getByTestId("line-selector")).toBeEnabled();
}

/**
 * Crea un pedido propio y devuelve su dirección.
 *
 * **No se reutiliza un pedido de la semilla**: esta suite lo mueve por todos
 * sus estados y lo archiva, y las tarjetas sembradas son fixtures que otras
 * suites afirman —`seed_geeko` cuenta la cola de Sublimación, `order-board`
 * comprueba su numeración—. Mutarlas rompería pruebas que no tienen nada que
 * ver con esta.
 */
async function createOwnOrder(page: Page, nota: string): Promise<string> {
  await page.goto("/orders/new");

  await page.getByTestId("line-select").click();
  await page.getByRole("option", { name: "Sublimación", exact: true }).click();

  // Se elige un cliente ya sembrado en vez de crear uno: leerlo no muta nada,
  // y lo que esta suite necesita propio es el pedido, no el directorio.
  await page.getByLabel("Cliente").fill("María");
  await page.getByRole("button", { name: "María Céspedes", exact: true }).click();
  await expect(page.getByTestId("contact-selected")).toContainText("María Céspedes");

  // «Bolsa de regalo» no tiene variantes: agregarla es un solo clic y la línea
  // del pedido queda completa sin pasar por el selector de variante.
  await page.getByLabel("Agregar del catálogo").fill("Bolsa");
  await page
    .getByTestId("catalog-options")
    .getByRole("button", { name: /Bolsa de regalo/ })
    .first()
    .click();
  await expect(page.getByTestId("order-line-row")).toHaveCount(1);

  // Una fecha comprometida bien adelante: es de donde sale la fecha que
  // *Crear tarea para este pedido* propone, y así no depende del día en que
  // corra la prueba.
  await page.getByLabel("Fecha comprometida").fill("2027-06-15");
  await page.getByLabel("Nota").fill(nota);

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.waitForURL(/\/orders\/[0-9a-f]{8}-[0-9a-f-]+$/);

  return page.url();
}

/**
 * KAM-15 · *Crear tarea para este pedido*.
 *
 * Escenarios del delta spec `tasks` — requisito "Crear tarea para este pedido
 * con formulario prellenado": «Formulario prellenado», «Todo es modificable»,
 * «El vínculo queda guardado».
 */
test.describe.serial("crear tarea para este pedido (V4 → alta)", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "usa el selector de línea del menú lateral");

  test("el formulario llega prellenado desde el pedido", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await createOwnOrder(page, `Prellenado ${Date.now()}`);

    await page.getByTestId("create-task-for-order").click();
    await page.waitForURL(/\/tasks\/new\?orderId=/);

    // Título que nombra el pedido, para que la tarjeta se entienda sola.
    await expect(page.getByLabel("Título")).toHaveValue(/pedido #\d+/);

    // El vínculo al pedido llega marcado: es la propuesta.
    const vinculo = page.getByTestId("task-link");
    await expect(vinculo).toBeVisible();
    await expect(vinculo.getByRole("checkbox")).toBeChecked();

    // Y una fecha límite sugerida. Que sea **anterior** a la de entrega lo fija
    // `suggested-due-date.test.ts` sobre la función pura, con sus casos de
    // borde —entrega hoy, entrega pasada, fin de mes, año bisiesto—; aquí lo
    // que se comprueba es que esa sugerencia llega al formulario.
    const sugerida = await page.getByLabel("Fecha límite").inputValue();
    expect(sugerida).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Y es anterior a la fecha comprometida del pedido, que es el criterio.
    expect(sugerida < "2027-06-15").toBe(true);
  });

  test("todo lo prellenado se puede cambiar, y el vínculo se guarda", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await createOwnOrder(page, `Prellenado ${Date.now()}`);
    await page.getByTestId("create-task-for-order").click();
    await page.waitForURL(/\/tasks\/new\?orderId=/);

    const titulo = `Arte a medida ${Date.now()}`;
    await page.getByLabel("Título").fill(titulo);
    await page.getByLabel("Fecha límite").fill("2026-12-24");

    await page.getByTestId("save-task").click();
    await page.waitForURL(/\/tasks$/);

    // Se guardó con lo que quedó en el formulario, no con lo prellenado.
    await page.goto("/tasks?view=list");
    const fila = page.getByTestId("task-row").filter({ hasText: titulo });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText("2026-12-24");
  });

  test("el vínculo se puede quitar antes de guardar", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await createOwnOrder(page, `Prellenado ${Date.now()}`);
    await page.getByTestId("create-task-for-order").click();
    await page.waitForURL(/\/tasks\/new\?orderId=/);

    const titulo = `Sin vínculo ${Date.now()}`;
    await page.getByLabel("Título").fill(titulo);
    await page.getByTestId("task-link").getByRole("checkbox").uncheck();

    await page.getByTestId("save-task").click();
    await page.waitForURL(/\/tasks$/);

    // La tarea existe igual: quitar el vínculo no impide guardarla.
    await page.goto("/tasks?view=list");
    await expect(page.getByTestId("task-row").filter({ hasText: titulo })).toHaveCount(1);
  });
});
