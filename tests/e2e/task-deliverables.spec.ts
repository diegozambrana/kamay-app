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

/** Crea una tarea desde el alta rápida y abre su detalle (V18). */
async function createTask(page: Page, prefix: string) {
  await selectLine(page, "Sublimación");
  await page.goto("/tasks");

  const title = `${prefix} ${Date.now()}`;
  await page.getByTestId("quick-add-task").click();
  await page.getByTestId("quick-add-title").fill(title);
  await page.getByTestId("quick-add-title").press("Enter");
  await expect(page.getByText(title)).toBeVisible();

  await page.locator('[data-testid="task-card"]', { hasText: title }).click();
  await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);

  return { title, url: page.url() };
}

/** Declara un entregable desde la sección de V18. */
async function declare(page: Page, label: string) {
  await page.getByLabel("Entregable esperado").click();
  await page.getByRole("option", { name: label }).click();
  await page.getByRole("button", { name: /Declarar/ }).click();
  await expect(page.getByTestId("declared-deliverables")).toContainText(label);
}

/**
 * Lleva la tarea al estado de tipo `final` desde el propio detalle.
 *
 * *Hecho* es el `final` del juego de tareas de la semilla. Con entregables sin
 * cumplir, cambiarlo abre el asistente en vez de cerrar en silencio.
 */
async function moveToFinal(page: Page) {
  await page.getByLabel("Estado").click();
  await page.getByRole("option", { name: "Hecho" }).click();
  await expect(page.getByTestId("closing-dialog")).toBeVisible();
}

/**
 * KAM-21 · El séptimo recorrido obligatorio de ARCHITECTURE.md.
 *
 * Cubre las tres salidas del asistente de cierre (V19) y el recorrido
 * bidireccional del vínculo, de la tarea al pedido y de vuelta.
 *
 * Escenarios del delta spec `task-links-deliverables`, requisito "El asistente
 * ofrece tres salidas y ninguna se penaliza": «Crear seleccionados cierra la
 * tarea», «Cerrar sin crear nada no pide nada», «Cancelar devuelve la tarea a
 * su estado anterior»; y "Archivar un registro referenciado avisa y no rompe
 * nada" → «Ningún vínculo queda roto».
 */
test.describe("cierre de tarea con entregables (V19)", () => {
  test.skip(
    ({ isMobile }) => Boolean(isMobile),
    "el recorrido parte del tablero, que es de escritorio; en móvil manda V20",
  );

  test("crear seleccionados y cerrar deja el registro y cierra la tarea", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    const { url } = await createTask(page, "Set de tazas e2e");

    await declare(page, "Nuevo producto");
    await moveToFinal(page);

    const nombre = `Taza e2e ${Date.now()}`;
    await page.getByLabel("Nombre").fill(nombre);
    await page
      .getByRole("button", { name: "Crear seleccionados y cerrar" })
      .click();

    // El producto entró al catálogo.
    await page.goto("/catalog?kind=product");
    await page.getByPlaceholder("Nombre del ítem").fill(nombre);
    await expect(
      page.getByTestId("catalog-row").filter({ hasText: nombre }),
    ).toBeVisible();

    // Y la tarea quedó cerrada, sin la marca de haber cerrado sin nada.
    await page.goto(url);
    await expect(page.getByTestId("declared-deliverables")).toContainText(
      "Creado",
    );
  });

  test("cerrar sin crear nada no pide justificación y deja su marca", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    const { title } = await createTask(page, "Cerrar a secas e2e");

    await declare(page, "Nuevo producto");
    await moveToFinal(page);

    await page.getByRole("button", { name: "Cerrar sin crear nada" }).click();

    // Ni advertencia ni campo de motivo por el camino.
    await expect(page.getByRole("alert")).toHaveCount(0);

    // La marca es discreta y el filtro la encuentra.
    await selectLine(page, "Sublimación");
    await page.goto("/tasks?nodeliv=1");
    await expect(
      page.locator('[data-testid="task-card"]', { hasText: title }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid="task-card"]', { hasText: title })
        .getByTestId("card-closed-without-deliverables"),
    ).toBeVisible();
  });

  test("cancelar no cierra la tarea ni crea nada", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    const { url } = await createTask(page, "Cancelar e2e");

    await declare(page, "Nuevo producto");
    await moveToFinal(page);

    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByTestId("closing-dialog")).toBeHidden();

    // El entregable sigue sin cumplir: no se creó nada.
    await page.goto(url);
    await expect(page.getByTestId("declared-deliverables")).not.toContainText(
      "Creado",
    );
  });
});

/**
 * El vínculo se ve desde los dos lados, y archivar el destino no lo rompe.
 */
test.describe("vínculos bidireccionales", () => {
  test.skip(
    ({ isMobile }) => Boolean(isMobile),
    "el recorrido parte del tablero, que es de escritorio; en móvil manda V20",
  );

  test("vincular un pedido, verlo desde el pedido y archivarlo sin romperlo", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    const { title, url } = await createTask(page, "Vínculo e2e");

    // ── Vincular desde la tarea ───────────────────────────────────────────
    await page.getByLabel("Buscar para vincular").fill("Pedido");
    const resultado = page.getByTestId("link-results").getByRole("button").first();
    await expect(resultado).toBeVisible();
    const etiqueta = (await resultado.textContent()) ?? "";
    await resultado.click();

    await expect(page.getByTestId("task-links")).toContainText(
      etiqueta.split("Pedido")[1] ? "Pedido" : etiqueta,
    );

    // ── El pedido lista la tarea ──────────────────────────────────────────
    await page.getByTestId("task-links").getByRole("link").first().click();
    await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Tareas relacionadas")).toBeVisible();
    await expect(page.getByTestId("related-tasks")).toContainText(title);

    // ── Y desde ahí se vuelve a la tarea ──────────────────────────────────
    await page
      .getByTestId("related-tasks")
      .getByRole("link")
      .filter({ hasText: title })
      .click();
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}/);
    // Es la misma tarea de la que partimos, no otra del mismo pedido.
    expect(new URL(page.url()).pathname).toBe(new URL(url).pathname);
  });

  test("archivar un ítem vinculado avisa y el vínculo sigue resolviendo", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    // Un ítem propio, para archivarlo sin tocar la semilla compartida.
    const nombre = `Insumo vinculado e2e ${Date.now()}`;
    await page.goto("/catalog?kind=supply");
    await page.getByRole("button", { name: /Nuevo/ }).first().click();
    await page.getByLabel("Nombre").fill(nombre);
    await page.getByRole("button", { name: /Crear|Guardar/ }).first().click();
    await expect(
      page.getByTestId("catalog-row").filter({ hasText: nombre }),
    ).toBeVisible();

    const { title, url } = await createTask(page, "Archivar vinculado e2e");
    await page.getByLabel("Buscar para vincular").fill(nombre);
    await page.getByTestId("link-results").getByRole("button").first().click();
    await expect(page.getByTestId("task-links")).toContainText(nombre);

    // Al detalle del ítem por el propio vínculo: es la ruta que la tarea ofrece.
    await page.getByTestId("task-links").getByRole("link").first().click();
    await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);

    // ── Archivar: el aviso enumera la tarea que lo referencia ─────────────
    await page.getByRole("button", { name: "Archivar" }).first().click();
    await expect(page.getByTestId("archive-warning")).toBeVisible();
    await expect(page.getByTestId("archive-warning-tasks")).toContainText(title);
    await page
      .getByTestId("archive-warning")
      .getByRole("button", { name: "Archivar" })
      .click();

    // ── El vínculo sigue en la tarea, señalado como archivado ─────────────
    await page.goto(url);
    await expect(page.getByTestId("task-links")).toContainText(nombre);
    await expect(page.getByTestId("link-archived")).toBeVisible();
  });
});
