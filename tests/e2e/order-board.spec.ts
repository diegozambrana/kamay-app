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

/** Fija la línea activa desde el selector global. */
async function selectLine(page: Page, name: string) {
  await page.getByTestId("line-selector").click();
  await page.getByRole("menuitem", { name }).click();
  await expect(page.getByTestId("line-selector")).toContainText(name);
  // El botón se rehabilita cuando la cookie ya está fijada: sin esperarla, la
  // navegación siguiente cancelaría la petición en vuelo.
  await expect(page.getByTestId("line-selector")).toBeEnabled();
}

// En serie y en un solo proyecto: la prueba de reordenamiento MUEVE las
// tarjetas de la cola de Sublimación que las demás afirman, y la semilla es
// compartida. El bloque entero se salta en móvil (no hay selector de línea),
// así que solo escritorio la ejecuta y no hay dos proyectos compitiendo.
test.describe.serial("tablero de pedidos (V3)", () => {
  // En móvil el selector vive en la tira de contexto y lleva su propio
  // identificador (`line-selector-mobile`), así que el helper de aquí —que
  // usa el del menú lateral— solo aplica en escritorio. El caso móvil se
  // cubre abajo, entrando por los botones del propio tablero.
  test.skip(({ isMobile }) => Boolean(isMobile), "este helper usa el selector del menú lateral");

  test("cada línea muestra exactamente sus columnas", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    // ── Sublimación: sus seis estados más Cancelado ───────────────────────
    await selectLine(page, "Sublimación");
    await page.goto("/orders");

    const sublimacion = await page
      .getByTestId("board-column")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-status-name")));

    expect(sublimacion).toEqual([
      "Registrado",
      "En diseño",
      "En cola",
      "Sublimando",
      "Listo para entrega",
      "Entregado",
      "Cancelado",
    ]);

    // ── Alfarería: sus tres, sin rastro de las de Sublimación ─────────────
    await selectLine(page, "Alfarería");
    await page.goto("/orders");

    const alfareria = await page
      .getByTestId("board-column")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-status-name")));

    expect(alfareria).toEqual([
      "Reservado",
      "Listo para entrega",
      "Entregado",
      "Cancelado",
    ]);
    expect(alfareria).not.toContain("En diseño");
    expect(alfareria).not.toContain("Sublimando");
    expect(alfareria).not.toContain("En cola");
  });

  test("la alerta de retraso ignora los estados de espera", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await page.goto("/orders?view=list");

    // #4 está vencido pero en "Listo para entrega" (waiting): no alerta.
    // #5 está vencido y en "En diseño" (in_progress): sí alerta.
    await page.goto("/orders");

    const enEspera = page.locator('[data-testid="order-card"][data-order-code="4"]');
    const enProceso = page.locator('[data-testid="order-card"][data-order-code="5"]');

    await expect(enEspera).toHaveAttribute("data-overdue", "0");
    await expect(enProceso).toHaveAttribute("data-overdue", "1");
    await expect(enProceso.getByTestId("overdue-alert")).toBeVisible();

    // #6 está vencido y entregado (final); #7 no tiene fecha: ninguno alerta.
    await expect(
      page.locator('[data-testid="order-card"][data-order-code="6"]'),
    ).toHaveAttribute("data-overdue", "0");
    await expect(
      page.locator('[data-testid="order-card"][data-order-code="7"]'),
    ).toHaveAttribute("data-overdue", "0");
  });

  test("la cola se numera por llegada, no por fecha comprometida", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await page.goto("/orders");

    const cola = page.locator('[data-testid="board-column"][data-is-queue="1"]');
    const tarjetas = cola.getByTestId("order-card");

    // La semilla los deja con fechas en orden inverso a la llegada: si el
    // tablero ordenara por urgencia, saldrían 3, 2, 1.
    await expect(tarjetas).toHaveCount(3);
    await expect(tarjetas.nth(0)).toHaveAttribute("data-order-code", "1");
    await expect(tarjetas.nth(1)).toHaveAttribute("data-order-code", "2");
    await expect(tarjetas.nth(2)).toHaveAttribute("data-order-code", "3");

    await expect(tarjetas.nth(0).getByTestId("queue-position")).toHaveText("1");
    await expect(tarjetas.nth(1).getByTestId("queue-position")).toHaveText("2");
    await expect(tarjetas.nth(2).getByTestId("queue-position")).toHaveText("3");

    // Las columnas que no son cola no muestran posición.
    const noCola = page
      .locator('[data-testid="board-column"][data-is-queue="0"]')
      .first();
    await expect(noCola.getByTestId("queue-position")).toHaveCount(0);
  });

  test("con la línea Todas el tablero pide elegir, pero lista y calendario cruzan", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Todas");
    await page.goto("/orders");

    await expect(page.getByTestId("board-needs-line")).toBeVisible();
    await expect(page.getByTestId("board-column")).toHaveCount(0);

    // La lista sí muestra los pedidos de todas las líneas.
    await page.getByRole("radio", { name: "Lista" }).click();
    await page.waitForURL(/view=list/);

    const filas = page.getByTestId("order-row");
    await expect(filas.filter({ hasText: "Macetas" })).toHaveCount(0); // resumen no va en la lista
    expect(await filas.count()).toBeGreaterThan(3);
  });

  test("los filtros sobreviven al cambio de vista y Ver archivados funciona", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await page.goto("/orders");

    // Por defecto el archivado (#11) no aparece.
    await expect(
      page.locator('[data-testid="order-card"][data-order-code="11"]'),
    ).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Ver archivados" }).click();
    await page.waitForURL(/archived=1/);
    await expect(
      page.locator('[data-testid="order-card"][data-order-code="11"]'),
    ).toBeVisible();

    // Cambiar de vista conserva el filtro.
    await page.getByRole("radio", { name: "Calendario" }).click();
    await page.waitForURL(/view=calendar/);
    expect(page.url()).toContain("archived=1");
    await expect(
      page.getByRole("checkbox", { name: "Ver archivados" }),
    ).toBeChecked();

    // El calendario agrupa por fecha y aparta los que no tienen.
    await expect(page.getByTestId("calendar-undated")).toBeVisible();
  });

  // Va la última del bloque: deja la cola en otro orden a propósito.
  test("reordenar la cola renumera al resto y persiste al recargar", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await page.goto("/orders");

    const cola = page.locator('[data-testid="board-column"][data-is-queue="1"]');
    const tarjetas = cola.getByTestId("order-card");
    await expect(tarjetas).toHaveCount(3);

    const tercera = cola.locator('[data-order-code="3"]');
    const primera = cola.locator('[data-order-code="1"]');

    // Arrastrar la tercera sobre la primera. dnd-kit necesita el gesto
    // completo —y pasar del umbral de 6 px—, no un solo `dragTo`.
    const origen = await tercera.boundingBox();
    const destino = await primera.boundingBox();
    if (!origen || !destino) throw new Error("no se pudieron ubicar las tarjetas");

    await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
    await page.mouse.down();
    await page.mouse.move(destino.x + destino.width / 2, destino.y + 5, { steps: 12 });
    await page.mouse.up();

    // La renumeración es consecutiva desde 1, sin huecos ni repeticiones.
    await expect(cola.locator('[data-order-code="3"]').getByTestId("queue-position"))
      .toHaveText("1");

    await page.reload();

    const despues = cola.getByTestId("order-card");
    await expect(despues.nth(0)).toHaveAttribute("data-order-code", "3");
    await expect(despues.nth(0).getByTestId("queue-position")).toHaveText("1");
    await expect(despues.nth(1).getByTestId("queue-position")).toHaveText("2");
    await expect(despues.nth(2).getByTestId("queue-position")).toHaveText("3");
  });
});

test.describe("tablero de pedidos en móvil", () => {
  test.skip(({ isMobile }) => !isMobile, "cubre el camino sin selector de línea");

  test("el aviso del tablero permite elegir línea sin la barra superior", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/orders");

    // Sin barra superior no hay selector global: el aviso de "Todas" es la
    // única vía, y por eso trae los botones de las líneas (design.md D1).
    const aviso = page.getByTestId("board-needs-line");
    await expect(aviso).toBeVisible();

    await aviso.getByRole("button", { name: "Sublimación" }).click();

    await expect(page.getByTestId("board-needs-line")).toHaveCount(0);
    await expect(page.getByTestId("board-column").first()).toBeVisible();
  });
});
