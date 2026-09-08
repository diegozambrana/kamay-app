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

/**
 * Crea una tarea con fecha límite y devuelve su título y su dirección.
 *
 * Se crea por la vía real —el formulario— y no sembrando la base: lo que estas
 * pruebas verifican es el recorrido entero, y una tarea sembrada por detrás no
 * probaría que el alta deja la tarea donde V20 la espera.
 */
async function createTaskDue(page: Page, dueDate: string) {
  const title = `Pendiente ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  await page.goto("/tasks/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Fecha límite").fill(dueDate);
  await page.getByTestId("save-task").click();
  await page.waitForURL(/\/tasks(\/[0-9a-f-]{36})?$/);

  return title;
}

/** Ayer y mañana en `YYYY-MM-DD`, para no depender del día en que se corra. */
function shiftedDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * KAM-17 · V20 · Mis pendientes.
 *
 * Escenarios del delta spec `my-tasks` — requisitos "Posponer a mañana en un
 * solo gesto" y "Marcar hecha deja la tarea tachada en su sitio"; y del delta
 * spec `notifications` — requisito "El enlace del correo abre exactamente esa
 * tarea, con o sin sesión".
 */
test.describe("mis pendientes (V20)", () => {
  test("posponer una tarea vencida la cambia de grupo", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    const title = await createTaskDue(page, shiftedDate(-3));

    await page.goto("/my-tasks");
    const row = page.locator("[data-testid^='pending-']").filter({ hasText: title });

    // Empieza en Vencidas.
    await expect(
      page.getByTestId("group-overdue").locator("li").filter({ hasText: title }),
    ).toHaveCount(1);

    await row.getByRole("button", { name: /Posponer/ }).click();

    // Y acaba en Próximos 7 días, sin salir de la pantalla.
    await expect(
      page.getByTestId("group-upcoming").locator("li").filter({ hasText: title }),
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(
      page.getByTestId("group-overdue").locator("li").filter({ hasText: title }),
    ).toHaveCount(0);
  });

  test("marcar hecha la deja tachada en su sitio, no la hace desaparecer", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    const title = await createTaskDue(page, shiftedDate(0));

    await page.goto("/my-tasks");
    const row = page.locator("[data-testid^='pending-']").filter({ hasText: title });
    await expect(row).toHaveCount(1);

    await row.getByRole("button", { name: /Marcar hecha/ }).click();

    // Sigue visible —tachada— y no se ha ido de la lista.
    await expect(row).toHaveAttribute("data-done", "true");
    await expect(row.getByRole("link", { name: title })).toHaveClass(
      /line-through/,
    );
  });

  test("cada fila dice de qué línea es, porque no hay selector aquí", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await createTaskDue(page, shiftedDate(1));

    await page.goto("/my-tasks");

    const first = page.locator("[data-testid^='pending-']").first();
    await expect(first).toBeVisible();
    // La línea va en la propia fila: sin selector, es lo único que lo dice.
    await expect(first.locator("span").first()).not.toBeEmpty();
  });
});

test.describe("el enlace de un aviso abre esa tarea", () => {
  test("con sesión activa lleva directo al detalle", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    const title = await createTaskDue(page, shiftedDate(2));

    await page.goto("/my-tasks");
    await page
      .locator("[data-testid^='pending-']")
      .filter({ hasText: title })
      .getByRole("link", { name: title })
      .click();

    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel("Título")).toHaveValue(title);
  });

  test("sin sesión, se identifica y aterriza en esa misma tarea", async ({
    page,
    context,
  }) => {
    // Se crea la tarea y se guarda su dirección, que es la que llevaría el
    // correo.
    await login(page, GEEKO_OWNER);
    const title = await createTaskDue(page, shiftedDate(2));

    await page.goto("/my-tasks");
    await page
      .locator("[data-testid^='pending-']")
      .filter({ hasText: title })
      .getByRole("link", { name: title })
      .click();
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
    const taskUrl = new URL(page.url()).pathname;

    // Se cierra la sesión: a partir de aquí es quien abre el correo sin haber
    // entrado.
    await context.clearCookies();

    await page.goto(taskUrl);
    await page.waitForURL(/\/auth\/login\?next=/);

    await page.getByLabel("Correo electrónico").fill(GEEKO_OWNER);
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    // Aterriza en la tarea, no en el panel ni en el registro rápido.
    await page.waitForURL(new RegExp(`${taskUrl}$`), { timeout: 20_000 });
    await expect(page.getByLabel("Título")).toHaveValue(title);
  });
});

test.describe("la bandeja de notificaciones (V21)", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "la campana vive en la barra superior, que es de escritorio");

  test("la campana abre la bandeja y ofrece sus preferencias", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    await page.getByTestId("notification-bell").click();
    await expect(page.getByTestId("notification-panel")).toBeVisible();

    // El mapa manda V21 → Preferencias → V15 → Notificaciones.
    await page
      .getByRole("link", { name: /Preferencias de notificación/ })
      .click();
    await page.waitForURL(/\/settings\/notifications$/);
    await expect(
      page.getByRole("heading", { name: "Notificaciones" }),
    ).toBeVisible();
  });

  test("el ayudante también llega a sus preferencias", async ({ page }) => {
    // Es la única sección de V15 abierta a los dos roles (design D1).
    await login(page, "ayudante@kamay.test");
    await page.goto("/settings/notifications");

    await expect(
      page.getByRole("heading", { name: "Notificaciones" }),
    ).toBeVisible();
    // Por rol y no por etiqueta: «Resumen diario» también casa con el
    // selector de hora, que se llama «Hora del resumen diario».
    await expect(
      page.getByRole("checkbox", { name: "Resumen diario" }),
    ).toBeVisible();
  });

  test("el ayudante sigue sin alcanzar la configuración del taller", async ({
    page,
  }) => {
    await login(page, "ayudante@kamay.test");
    await page.goto("/settings/general");

    // La guardia bajó del layout a las secciones, pero no se relajó.
    await expect(page).not.toHaveURL(/\/settings\/general$/);
  });
});
