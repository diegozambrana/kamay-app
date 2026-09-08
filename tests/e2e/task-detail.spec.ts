import { expect, test, type Page } from "@playwright/test";

import { noisePng } from "./helpers/png";

const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";
const MB = 1024 * 1024;

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
 * Crea una tarea desde el alta rápida del tablero y devuelve su título y su
 * dirección. El alta rápida es de KAM-15; aquí solo se usa para llegar a V18.
 */
async function createTask(page: Page, prefix: string): Promise<{ title: string; url: string }> {
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

/**
 * Alterna una casilla y espera a que la escritura llegue al servidor.
 *
 * La casilla es optimista: se pinta marcada antes de que el cuerpo se haya
 * reescrito. Recargar sin esperar la respuesta corre una carrera contra la
 * Server Action, y la pierde de vez en cuando.
 */
async function toggleChecklist(page: Page, index: number, checked: boolean) {
  const casilla = page.locator("[data-checklist-index]").nth(index);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.status() < 400,
    ),
    checked ? casilla.check() : casilla.uncheck(),
  ]);
}

/** Escribe el cuerpo y lo guarda, esperando a que el guardado se asiente. */
async function writeBody(page: Page, body: string) {
  const area = page.getByLabel("Descripción");
  await area.fill(body);
  await page.getByRole("button", { name: "Guardar descripción" }).click();
  await expect(page.getByRole("button", { name: "Guardar descripción" })).toBeDisabled();
}

/**
 * KAM-16 · V18 · Detalle de tarea.
 *
 * Escenarios del delta spec `task-detail`.
 */
test.describe("detalle de tarea (V18)", () => {
  test.describe("dirección propia", () => {
    test.skip(({ isMobile }) => Boolean(isMobile), "se llega desde el tablero, que es de escritorio");

    test("se llega desde el tablero y la dirección es compartible", async ({ page }) => {
      await login(page, GEEKO_OWNER);
      const { title, url } = await createTask(page, "Detalle desde tablero");

      // Se llega desde el tablero.
      await expect(page.getByLabel("Título")).toHaveValue(title);

      // Y la misma dirección, abierta a pelo, resuelve la misma tarea: es lo
      // que hace que un aviso o un vínculo puedan enlazarla.
      await page.goto("/dashboard");
      await page.goto(url);
      await expect(page.getByLabel("Título")).toHaveValue(title);
    });

    test("editar el cuerpo con la barra y verlo en la vista previa", async ({ page }) => {
      await login(page, GEEKO_OWNER);
      await createTask(page, "Cuerpo con negrita");

      const area = page.getByLabel("Descripción");
      await area.fill("Set de 6 tazas de gres");

      // Se selecciona «6 tazas» y se aplica negrita desde la barra: quien no
      // sabe Markdown no escribe asteriscos.
      await area.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(7, 14));
      await page.getByRole("button", { name: "Negrita" }).click();
      await expect(area).toHaveValue("Set de **6 tazas** de gres");

      await page.getByRole("button", { name: "Guardar descripción" }).click();
      await expect(page.getByRole("button", { name: "Guardar descripción" })).toBeDisabled();

      await page.reload();
      await page.getByRole("radio", { name: "Vista previa" }).click();
      await expect(page.locator("strong", { hasText: "6 tazas" })).toBeVisible();
    });

    test("marcar una casilla persiste y no toca las demás", async ({ page }) => {
      await login(page, GEEKO_OWNER);
      await createTask(page, "Hornada con pasos");

      await writeBody(
        page,
        [
          "- [ ] Modelado",
          "- [ ] Secado",
          "- [ ] Primera quema",
          "- [ ] Esmaltado",
          "- [ ] Segunda quema",
        ].join("\n"),
      );

      await page.getByRole("radio", { name: "Vista previa" }).click();
      const casillas = page.locator("[data-checklist-index]");
      await expect(casillas).toHaveCount(5);

      await toggleChecklist(page, 2, true);
      await expect(casillas.nth(2)).toBeChecked();

      await page.reload();
      await page.getByRole("radio", { name: "Vista previa" }).click();

      // Sigue marcada, y las otras cuatro no se movieron.
      await expect(page.locator("[data-checklist-index]").nth(2)).toBeChecked();
      for (const i of [0, 1, 3, 4]) {
        await expect(page.locator("[data-checklist-index]").nth(i)).not.toBeChecked();
      }

      // Y desmarcar también persiste.
      await toggleChecklist(page, 2, false);
      await page.reload();
      await page.getByRole("radio", { name: "Vista previa" }).click();
      await expect(page.locator("[data-checklist-index]").nth(2)).not.toBeChecked();
    });

    test("adjuntar una imagen grande sin dejar de editar el cuerpo", async ({ page }) => {
      await login(page, GEEKO_OWNER);
      await createTask(page, "Tarea con adjunto");

      // Un PNG de ruido de 2000 × 2000: pesa unos 12 MB y el navegador lo
      // decodifica. Sin comprimir no cabría en el bucket.
      const buffer = noisePng(2000, 2000);
      expect(buffer.length).toBeGreaterThan(8 * MB);

      await page.locator('input[type="file"]').setInputFiles({
        name: "avance-hornada.png",
        mimeType: "image/png",
        buffer,
      });

      // Mientras sube, el cuerpo se sigue editando y guardando.
      await writeBody(page, "Foto del avance de la segunda quema.");

      const adjunto = page.getByTestId("attachment");
      await expect(adjunto).toHaveCount(1, { timeout: 60_000 });

      // Y llegó comprimido: el límite del bucket es de 5 MB.
      const sizeBytes = Number(await adjunto.getAttribute("data-size-bytes"));
      expect(sizeBytes).toBeGreaterThan(0);
      expect(sizeBytes).toBeLessThanOrEqual(5 * MB);
    });

    test("quitar un adjunto libera ranura y no lo borra", async ({ page }) => {
      await login(page, GEEKO_OWNER);
      await createTask(page, "Tarea con adjunto retirado");

      const subir = (name: string) =>
        page.locator('input[type="file"]').setInputFiles({
          name,
          mimeType: "image/png",
          buffer: noisePng(80, 80),
        });

      await subir("primera.png");
      await expect(page.getByTestId("attachment")).toHaveCount(1, { timeout: 60_000 });

      await page.getByRole("button", { name: "Quitar primera.png" }).click();
      await expect(page.getByTestId("attachment")).toHaveCount(0);

      // La ranura vuelve a estar libre: se puede adjuntar otro.
      await subir("segunda.png");
      await expect(page.getByTestId("attachment")).toHaveCount(1, { timeout: 60_000 });
      await expect(page.getByTestId("attachment")).toContainText("segunda.png");

      // Que retirar **archive y no borre** no se ve desde aquí: el historial de
      // la tarea lee `activity_log` filtrado por `tasks`, y archivar un adjunto
      // se registra contra `attachments`. Eso se comprueba en pgTAP
      // (`attachments_storage.test.sql`), que es donde se puede mirar la fila.
    });

    test("cambiar el responsable no exige guardar nada más", async ({ page }) => {
      await login(page, GEEKO_OWNER);
      await createTask(page, "Tarea reasignada");

      await page.getByLabel("Responsable").click();
      const opcion = page.getByRole("option").nth(1);
      const nombre = (await opcion.textContent())?.trim() ?? "";
      await opcion.click();

      // Sin pulsar ningún guardar: se recarga y el cambio está.
      await page.reload();
      await expect(page.getByLabel("Responsable")).toContainText(nombre);
    });

    test("el historial sale de la bitácora, con la creación primero", async ({ page }) => {
      await login(page, GEEKO_OWNER);
      await createTask(page, "Tarea con historial");

      // Una tarea recién creada ya tiene su primera entrada.
      await expect(
        page.locator('[data-testid="history-entry"][data-action="created"]'),
      ).toHaveCount(1);

      await writeBody(page, "Notas de la hornada.");
      await page.reload();

      // Lo más reciente encabeza la lista.
      const filas = page.getByTestId("history-entry");
      await expect(filas.first()).toContainText("Editada");
      await expect(filas.last()).toContainText("Registrada");
    });

    /**
     * *Una tarea archivada no se edita* no tiene recorrido e2e, y no por
     * descuido: **no existe ninguna forma de archivar una tarea desde la
     * interfaz**. KAM-15 dejó la acción `archiveTask` y el filtro *Ver
     * archivados* del tablero, pero ningún control que la invoque —hoy
     * `archiveTask` no tiene un solo llamador en la aplicación—, así que no
     * hay manera de llegar a una tarea archivada para abrirla.
     *
     * El escenario sí está cubierto en el nivel unitario, sobre los cuatro
     * componentes que lo implementan: `task-fields`, `markdown-editor`,
     * `checklist-preview` y `attachment-panel` congelan sus controles con
     * `readOnly`. Lo que falta es el camino, no el comportamiento.
     */
  });

  test.describe("en el celular", () => {
    test.skip(({ isMobile }) => !isMobile, "el criterio es de 390 px");

    test("ocupa la pantalla completa y no se desplaza en horizontal", async ({ page }) => {
      await login(page, GEEKO_OWNER);

      // Sin elegir línea: la vista de lista cruza todas, y el selector móvil
      // vive en la tira de contexto, que no es lo que se está probando aquí.
      // Se llega por dirección porque en móvil la puerta de las tareas es V20.
      await page.goto("/tasks?view=list");
      const fila = page.getByTestId("task-row").first();
      await expect(fila).toBeVisible();
      const id = await fila.getAttribute("data-task-id");
      await page.goto(`/tasks/${id}`);

      // La barra inferior no se rinde: V18 es captura larga.
      await expect(page.getByTestId("bottom-bar")).toHaveCount(0);

      // Y nada obliga a desplazarse en horizontal.
      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(desborda).toBe(false);
    });
  });
});
