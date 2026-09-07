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
 * KAM-15 · Alta rápida de tarea.
 *
 * Escenarios del delta spec `tasks` — requisito "Alta rápida de tarea en tres
 * interacciones o menos": «Crear una tarea con la línea activa» y «La tarea
 * aparece en el acto».
 *
 * El criterio de aceptación nº 7 pide que la **medición quede registrada en la
 * prueba**, no solo que la tarea se cree: por eso se cuentan las interacciones
 * una a una y se afirma el total.
 */
test.describe("alta rápida de tarea (V17)", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "el tablero es de escritorio; en móvil manda V20");

  test("crear una tarea toma 3 interacciones o menos", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await page.goto("/tasks");

    const titulo = `Revisar filamento ${Date.now()}`;

    // Cada gesto de la persona cuenta como una interacción. La navegación
    // hasta el tablero no cuenta: la medición es "estando en el tablero,
    // cuánto cuesta anotar un pendiente".
    let interacciones = 0;

    // 1 · abrir el compositor
    await page.getByTestId("quick-add-task").click();
    interacciones += 1;

    // 2 · escribir el título
    await page.getByTestId("quick-add-title").fill(titulo);
    interacciones += 1;

    // 3 · confirmar
    await page.getByTestId("quick-add-title").press("Enter");
    interacciones += 1;

    // La medición, registrada: es el criterio de aceptación nº 7.
    expect(interacciones).toBeLessThanOrEqual(3);

    // La tarjeta aparece sin recargar la pantalla.
    await expect(page.getByText(titulo)).toBeVisible();

    // Y nace en la columna inicial, con el estado que puso la base.
    const inicial = page.locator('[data-testid="task-column"][data-status-kind="initial"]');
    await expect(inicial.getByText(titulo)).toBeVisible();
  });

  test("el alta rápida no pide ningún dato más que el título", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await page.goto("/tasks");

    await page.getByTestId("quick-add-task").click();

    // Lo que mantiene el alta en tres interacciones es justamente esto: la
    // línea viene del selector y el estado lo pone la base.
    await expect(page.getByLabel("Título de la tarea")).toBeVisible();
    await expect(page.getByLabel("Fecha límite")).toHaveCount(0);
  });

  test("la tarea persiste al recargar", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await page.goto("/tasks");

    const titulo = `Persistente ${Date.now()}`;
    await page.getByTestId("quick-add-task").click();
    await page.getByTestId("quick-add-title").fill(titulo);
    await page.getByTestId("quick-add-title").press("Enter");
    await expect(page.getByText(titulo)).toBeVisible();

    await page.reload();
    await expect(page.getByText(titulo)).toBeVisible();
  });
});
