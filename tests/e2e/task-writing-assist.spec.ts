import { createFreshOrganization, E2E_PASSWORD } from "./helpers/fresh-org";
import { expect, test, type Page } from "./helpers/test";

/**
 * KAM-30 · Asistencia de redacción en la descripción de la tarea.
 *
 * Escenarios de la spec `ai-writing-assist` y `task-detail` que no dependen
 * de una respuesta real del modelo: "La interfaz no ofrece la acción" (sin
 * activar) y "Sin conexión no se ofrece un intento fallido". El flujo
 * completo de mejorar/aceptar/descartar contra una propuesta real —8.2 y
 * 8.3 del plan— no tiene recorrido e2e posible en este entorno: no hay
 * `ANTHROPIC_API_KEY` de pruebas (ni debería haberla, para no depender de una
 * cuenta real ni de una respuesta no determinista), y `resolveAiAssistant()`
 * no tiene una puerta de sustitución para e2e — el puerto (`MemoryAiAssistant`
 * / `FailingAiAssistant`) es explícitamente para pruebas unitarias e de
 * integración, no de navegador. Ese flujo completo —pedir, ver la propuesta,
 * aceptar o descartar, la advertencia de ítems perdidos— ya queda cubierto a
 * nivel de componente en `features/tasks/editor/markdown-editor.test.tsx`.
 */

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * Crea la tarea desde el formulario completo (`/tasks/new`), no desde el alta
 * rápida del tablero: una organización recién creada no tiene una línea
 * activa resuelta para el compositor en línea, que entonces manda aquí de
 * todos modos (`features/tasks/board/quick-add.tsx`). La línea de negocio ya
 * viene con la primera seleccionada, así que basta con el título.
 *
 * Y se llega a ella por la vista de **lista** (`?view=list`), no por el
 * tablero: el tablero exige una línea activa para elegir su juego de
 * estados ("Elige una línea para ver el tablero"), y esta organización nunca
 * seleccionó ninguna.
 */
async function createTaskWithBody(page: Page, title: string, body: string) {
  await page.goto("/tasks/new");
  await page.getByLabel("Título").fill(title);
  await page.getByTestId("save-task").click();
  await page.waitForURL(/\/tasks(\?.*)?$/);

  await page.goto("/tasks?view=list");
  const row = page.getByTestId("task-row").filter({ hasText: title });
  await expect(row).toBeVisible();
  const href = await row.getByRole("link", { name: title }).getAttribute("href");
  if (!href) throw new Error("la fila de la tarea no tiene enlace");

  // `goto` y no `click()`: una navegación entera, para no depender de la
  // caché de rutas del enlace del lado del cliente y leer la asistencia de
  // redacción tal como quedó guardada.
  await page.goto(href);

  await page.getByTestId("write-body").click();
  await page.getByLabel("Descripción").fill(body);
  await page.getByTestId("save-body").click();
  await expect(page.getByTestId("edit-body")).toBeVisible();
}

async function activateWritingAssist(page: Page) {
  await page.goto("/settings/general");

  const checkbox = page.getByLabel("Activar la asistencia de redacción");
  await checkbox.check();

  const form = page.locator("form").filter({ has: checkbox });
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByRole("status")).toHaveText("Cambios guardados.");
}

test.describe("Asistencia de redacción por IA (KAM-30)", () => {
  test("una organización que no la activó no ve la acción", async ({ page }) => {
    const owner = await createFreshOrganization();
    await login(page, owner.email);

    await createTaskWithBody(
      page,
      `Sin asistencia ${Date.now()}`,
      "Texto escrito a mano, sin ninguna asistencia.",
    );

    await page.getByTestId("edit-body").click();
    await expect(page.getByTestId("improve-body")).toHaveCount(0);
  });

  test("sin conexión, la acción deja de ofrecerse sin un intento fallido", async ({
    page,
    context,
  }) => {
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await activateWritingAssist(page);

    await createTaskWithBody(
      page,
      `Con asistencia ${Date.now()}`,
      "Texto escrito a mano, para mejorar.",
    );

    // Una recarga entera, para partir de un estado asentado y no de lo que
    // haya quedado en memoria justo después del guardado anterior.
    await page.reload();
    await page.getByTestId("edit-body").click();
    await expect(page.getByTestId("improve-body")).toBeVisible();

    await context.setOffline(true);
    try {
      await expect(page.getByTestId("improve-body")).toHaveCount(0);
    } finally {
      // Deja el contexto como lo encontró para cualquier prueba que reutilice
      // este navegador.
      await context.setOffline(false);
    }
  });
});
