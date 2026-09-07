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
 * Espera a que el tablero esté **hidratado**, no solo pintado.
 *
 * dnd-kit no escucha el puntero hasta que React toma el control, y un arrastre
 * anterior a ese momento no mueve nada: la prueba se queda esperando una
 * respuesta que nunca se pidió. Abrir y cerrar el compositor es la prueba más
 * barata de que los manejadores ya están vivos —solo responde si lo están— y
 * no deja ningún rastro.
 */
async function waitForBoardReady(page: Page) {
  await page.getByTestId("quick-add-task").click();
  await expect(page.getByTestId("quick-add-title")).toBeVisible();
  await page.getByTestId("quick-add-title").press("Escape");
  await expect(page.getByTestId("quick-add-task")).toBeVisible();
}

/**
 * Arrastra una tarjeta hasta una columna. dnd-kit necesita el gesto completo
 * —y pasar del umbral de 6 px—, no un solo `dragTo`.
 *
 * La tarjeta se busca **dentro del tablero**: el `DragOverlay` rinde un clon
 * fuera de él y su animación de caída sobrevive unos milisegundos al
 * `mouse.up()`, así que un arrastre encadenado con el anterior encontraría dos
 * tarjetas con el mismo título.
 */
async function dragCardToColumn(page: Page, cardText: string, columnName: string) {
  const card = page
    .getByTestId("tasks-board")
    .getByTestId("task-card")
    .filter({ hasText: cardText });
  const column = page.locator(
    `[data-testid="task-column"][data-status-name="${columnName}"]`,
  );

  // El movimiento se pinta antes de que el servidor conteste, así que hay que
  // esperar la respuesta de la acción: recargar antes cancelaría la petición en
  // vuelo y la tarea volvería a su columna anterior sin que nadie lo pidiera.
  const confirmed = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes("/tasks"),
  );

  // `hover()` espera a que el elemento esté **quieto** antes de posarse encima.
  // Es lo que resuelve el encadenado: la acción revalida la ruta al confirmar,
  // así que el tablero se repinta después, y unas coordenadas medidas a mano
  // justo antes apuntarían a donde la tarjeta estaba —el segundo arrastre
  // caería sobre su propia columna y no habría movimiento que esperar—.
  await card.hover();
  await page.mouse.down();

  // Un primer movimiento corto pasa el umbral de 6 px y arranca el arrastre;
  // `hover()` sobre la columna lleva la tarjeta al destino con dnd-kit ya
  // escuchando, y también espera a que la columna esté quieta.
  const grabbed = (await card.boundingBox())!;
  await page.mouse.move(grabbed.x + grabbed.width / 2 + 10, grabbed.y + grabbed.height / 2, {
    steps: 3,
  });
  await column.hover();
  await page.mouse.up();

  await confirmed;

  await expect(
    column.getByTestId("task-card").filter({ hasText: cardText }),
  ).toHaveCount(1);
}

/**
 * KAM-15 · El arrastre del tablero de tareas.
 *
 * Escenarios del delta spec `tasks` — requisito "El arrastre funciona en ambos
 * sentidos y sin efectos secundarios": «Volver a una columna anterior», «El
 * movimiento se ve antes que la respuesta», «El historial recoge el ir y
 * venir».
 */
test.describe.serial("tablero de tareas (V17)", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "el tablero es de escritorio; en móvil manda V20");

  // Línea propia. Las suites corren en paralelo sobre una sola base, y una
  // tarea creada por otro worker en la misma línea reordenaría estas columnas
  // entre medir la tarjeta y arrastrarla: el gesto acabaría en el vacío.
  // Impresión 3D no la usa ninguna otra suite de tareas.
  const LINEA = "Impresión 3D";

  const titulo = `Arrastrable ${Date.now()}`;

  test("una tarea avanza y vuelve atrás sin advertencias ni confirmaciones", async ({
    page,
  }) => {
    // Dos arrastres con su ida y vuelta al servidor: con la suite completa en
    // paralelo, el límite por omisión se queda corto.
    test.setTimeout(60_000);
    await login(page, GEEKO_OWNER);
    await selectLine(page, LINEA);
    await page.goto("/tasks");
    await waitForBoardReady(page);

    await page.getByTestId("quick-add-task").click();
    await page.getByTestId("quick-add-title").fill(titulo);
    await page.getByTestId("quick-add-title").press("Enter");
    await expect(page.getByText(titulo)).toBeVisible();

    // ── Adelante: Por hacer → En revisión ────────────────────────────────
    await dragCardToColumn(page, titulo, "En revisión");

    const enRevision = page.locator(
      '[data-testid="task-column"][data-status-name="En revisión"]',
    );
    await expect(enRevision.getByText(titulo)).toBeVisible();

    // ── Atrás: En revisión → Por hacer ───────────────────────────────────
    // Es el caso que el criterio nº 2 nombra: una revisión que vuelve es lo
    // normal, no una excepción que haya que justificar.
    await dragCardToColumn(page, titulo, "Por hacer");

    const porHacer = page.locator(
      '[data-testid="task-column"][data-status-name="Por hacer"]',
    );
    await expect(porHacer.getByText(titulo)).toBeVisible();

    // Ni diálogo de confirmación, ni aviso, ni error.
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("task-error")).toHaveCount(0);

    // Y el movimiento persiste: no fue solo optimismo de la interfaz.
    await page.reload();
    await expect(porHacer.getByText(titulo)).toBeVisible();
  });

  test("retroceder desde el estado final vuelve a abrir la tarea", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, GEEKO_OWNER);
    await selectLine(page, LINEA);
    await page.goto("/tasks");
    await waitForBoardReady(page);

    await dragCardToColumn(page, titulo, "Hecho");
    await expect(
      page.locator('[data-testid="task-column"][data-status-name="Hecho"]').getByText(titulo),
    ).toBeVisible();

    await dragCardToColumn(page, titulo, "Haciendo");
    await page.reload();

    await expect(
      page.locator('[data-testid="task-column"][data-status-name="Haciendo"]').getByText(titulo),
    ).toBeVisible();
  });

  test("las columnas son el juego de estados de la línea, no una lista fija", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, LINEA);
    await page.goto("/tasks");

    const columnas = await page
      .getByTestId("task-column")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-status-name")));

    // El juego de tareas de la organización, sembrado por KAM-05.
    expect(columnas).toEqual(["Por hacer", "Haciendo", "En revisión", "Hecho"]);
  });

  test("la vista de lista y la de calendario muestran las mismas tareas", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, LINEA);

    await page.goto("/tasks?view=list");
    await expect(page.getByTestId("tasks-list")).toBeVisible();
    await expect(page.getByTestId("task-row").filter({ hasText: titulo })).toHaveCount(1);

    await page.goto("/tasks?view=calendar");
    await expect(page.getByText(titulo)).toBeVisible();
  });

  test("los filtros sobreviven al cambio de vista", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, LINEA);

    await page.goto(`/tasks?view=list&q=${encodeURIComponent(titulo)}`);
    await expect(page.getByTestId("task-row")).toHaveCount(1);

    await page.getByRole("radio", { name: "Calendario" }).click();

    // El filtro sigue en la dirección porque nunca salió de ella.
    await expect(page).toHaveURL(/q=/);
    await expect(page).toHaveURL(/view=calendar/);
  });
});
