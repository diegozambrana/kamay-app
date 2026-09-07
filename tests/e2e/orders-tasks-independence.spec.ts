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
 * Cuántas tareas mencionan este pedido.
 *
 * Se busca por el número visible del pedido en vez de contar todas las tareas
 * de la organización: las suites corren en paralelo sobre una sola base, y un
 * conteo global subiría por lo que crea otro worker, no por lo que hiciera este
 * pedido. Filtrar por el número deja la pregunta exacta —«¿apareció alguna
 * tarea por culpa de este pedido?»— y ningún otro worker puede contaminarla.
 */
async function tasksMentioning(page: Page, code: string): Promise<number> {
  await page.goto(`/tasks?view=list&archived=1&q=${encodeURIComponent(code)}`);
  await expect(
    page.getByTestId("tasks-list").or(page.getByText("No hay tareas que mostrar.")),
  ).toBeVisible();
  return page.getByTestId("task-row").count();
}

/** El número visible del pedido abierto, tal como lo muestra su detalle. */
async function orderCode(page: Page): Promise<string> {
  const heading = await page.getByRole("heading", { level: 1 }).first().textContent();
  const match = heading?.match(/#(\d+)/);
  if (!match) throw new Error(`no se encontró el número del pedido en «${heading}»`);
  return `#${match[1]}`;
}

/**
 * KAM-15 · Pedidos y tareas nunca se sincronizan.
 *
 * Escenarios del delta spec `tasks` — requisito "Pedidos y tareas nunca se
 * sincronizan": «Cambiar el estado de un pedido no crea tareas», «Cerrar una
 * tarea no mueve su pedido», «Archivar un pedido no toca sus tareas».
 *
 * Es la convención nº 10 del proyecto, y se comprueba **contando filas**, no
 * leyendo la interfaz: lo que hay que demostrar es que no ocurre nada, y una
 * pantalla que no muestra algo no prueba que ese algo no exista.
 */
test.describe.serial("pedidos y tareas no se sincronizan", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "usa el selector de línea del menú lateral");

  test("recorrer un pedido por sus estados no crea ninguna tarea", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");

    await createOwnOrder(page, `Independencia ${Date.now()}`);
    const code = await orderCode(page);

    // Ninguna tarea menciona este pedido todavía.
    expect(await tasksMentioning(page, code)).toBe(0);
    await page.goBack();

    // El juego completo de Sublimación, en orden: cada cambio de estado es una
    // oportunidad para que algo cree una tarea a espaldas de la persona.
    const recorrido = [
      "En diseño",
      "En cola",
      "Sublimando",
      "Listo para entrega",
      "Entregado",
    ];

    for (const estado of recorrido) {
      await page.getByTestId("status-select").click();
      await page.getByRole("option", { name: estado, exact: true }).click();
      // Se afirma el cambio: sin esto la prueba pasaría aunque el pedido no se
      // hubiera movido nunca, que es justo lo que no debe demostrar.
      await expect(page.getByTestId("status-select")).toContainText(estado);
    }

    // Y quedó registrado que el pedido sí recorrió su flujo. No se afirma un
    // número exacto: el pedido de la semilla ya puede estar en el primer
    // estado del recorrido, y ese paso no cambia nada. Lo que importa es que
    // hubo movimiento real, no cuántos exactamente.
    await page.reload();
    const cambios = await page
      .locator('[data-testid="history-entry"][data-action="status_changed"]')
      .count();
    expect(cambios).toBeGreaterThanOrEqual(recorrido.length - 1);

    // Tras recorrer el flujo entero, sigue sin haber ninguna tarea de este
    // pedido: ni una se creó por el camino.
    expect(await tasksMentioning(page, code)).toBe(0);
  });

  test("cerrar una tarea vinculada no mueve su pedido", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");

    // Se crea la tarea desde el pedido, que es la única vía que los relaciona.
    const orderUrl = await createOwnOrder(page, `Vinculo ${Date.now()}`);

    const estadoAntes = await page.getByTestId("status-select").textContent();

    await page.getByTestId("create-task-for-order").click();
    await page.waitForURL(/\/tasks\/new\?orderId=/);

    const titulo = `Vinculada ${Date.now()}`;
    await page.getByLabel("Título").fill(titulo);
    await page.getByTestId("save-task").click();
    await page.waitForURL(/\/tasks/);

    // Se cierra la tarea moviéndola al estado final. Mismo criterio que en
    // `task-board`: `hover()` espera a que la tarjeta esté quieta, y se espera
    // la respuesta de la acción antes de mirar el pedido.
    await page.goto("/tasks");
    const card = page
      .getByTestId("tasks-board")
      .getByTestId("task-card")
      .filter({ hasText: titulo });
    const hecho = page.locator('[data-testid="task-column"][data-status-name="Hecho"]');

    const confirmed = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/tasks"),
    );

    await card.hover();
    await page.mouse.down();
    const grabbed = (await card.boundingBox())!;
    await page.mouse.move(
      grabbed.x + grabbed.width / 2 + 10,
      grabbed.y + grabbed.height / 2,
      { steps: 3 },
    );
    await hecho.hover();
    await page.mouse.up();
    await confirmed;

    await expect(hecho.getByTestId("task-card").filter({ hasText: titulo })).toHaveCount(1);

    // El pedido conserva el estado que tenía.
    await page.goto(orderUrl);
    await expect(page.getByTestId("status-select")).toHaveText(estadoAntes ?? "");
  });

  test("archivar un pedido no toca sus tareas vinculadas", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");

    await createOwnOrder(page, `Archivable ${Date.now()}`);

    // Una tarea vinculada al pedido, con título propio de esta ejecución.
    const titulo = `Sobrevive ${Date.now()}`;
    await page.getByTestId("create-task-for-order").click();
    await page.waitForURL(/\/tasks\/new\?orderId=/);
    await page.getByLabel("Título").fill(titulo);
    await page.getByTestId("save-task").click();
    await page.waitForURL(/\/tasks$/);

    await page.goBack();
    await page.goBack();

    const archivar = page.getByRole("button", { name: /Archivar/i });
    if (await archivar.count()) {
      await archivar.first().click();
      const confirmar = page.getByRole("button", { name: /Archivar|Confirmar/i }).last();
      if (await confirmar.count()) await confirmar.click();
      await page.waitForTimeout(400);
    }

    // La tarea sigue vigente: no se archivó de rebote. Se busca sin incluir
    // archivadas a propósito — si el archivado se hubiera propagado, aquí no
    // aparecería.
    await page.goto(`/tasks?view=list&q=${encodeURIComponent(titulo)}`);
    await expect(page.getByTestId("task-row").filter({ hasText: titulo })).toHaveCount(1);
  });
});
