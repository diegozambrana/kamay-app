import { signedInClient } from "./helpers/fresh-org";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

const PASSWORD = "kamay123";

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

/** Crea una tarea desde el alta rápida del tablero y la deja abierta. */
/** Las migas viven en su propia navegación, rotulada «Ruta». */
function crumb(page: Page, name: string) {
  return page.getByLabel("Ruta").getByRole("link", { name });
}

/**
 * Alterna una casilla y espera a que la escritura llegue al servidor: la
 * casilla es optimista y recargar sin esperar corre una carrera.
 */
async function toggleChecklist(page: Page, index: number) {
  const casilla = page.locator("[data-checklist-index]").nth(index);
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === "POST" && response.status() < 400,
    ),
    casilla.check(),
  ]);
}

async function createTask(page: Page, prefix: string): Promise<string> {
  await selectLine(page, "Sublimación");
  await page.goto("/tasks");

  const title = `${prefix} ${Date.now()}`;
  await page.getByTestId("quick-add-task").click();
  await page.getByTestId("quick-add-title").fill(title);
  await page.getByTestId("quick-add-title").press("Enter");
  await expect(page.getByText(title)).toBeVisible();

  return title;
}

/**
 * KAM-29 · Escenarios del delta spec `task-detail` —requisito «La edición de
 * la tarea reúne sus datos en un formulario con un solo Guardar»— y del de
 * `navigation-breadcrumbs`.
 *
 * Es de escritorio: se llega desde el tablero, que no se rinde en el celular.
 */
test.describe("edición de tarea (V18-edit)", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "se llega desde el tablero, que es de escritorio");

  test("editar desde el tablero filtrado, guardar y volver al origen", async ({
    page,
  }) => {
    await login(page, geeko().owner);
    const title = await createTask(page, "Tarea que se edita");

    // Se filtra el tablero: esa es la vista a la que hay que volver.
    await page.goto("/tasks?view=list&q=" + encodeURIComponent(title));
    await page
      .locator('[data-testid="task-row"]', { hasText: title })
      .getByRole("link", { name: title })
      .click();
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}\?from=/);

    // El detalle se lee; para cambiar hay que pedirlo.
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.getByTestId("edit-task").click();
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}\/edit\?from=/);

    // Las migas nombran la tarea y su lista de origen.
    await expect(crumb(page, "Tareas")).toBeVisible();
    await expect(crumb(page, title)).toBeVisible();

    const nuevo = `${title} (editada)`;
    await page.getByLabel("Título").fill(nuevo);
    await page.getByLabel("Fecha límite").fill("2026-12-24");
    await page.getByTestId("save-task").click();

    // Aterriza en el detalle con los valores nuevos.
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}(\?.*)?$/);
    await expect(page.getByRole("heading", { name: nuevo })).toBeVisible();
    await expect(page.getByText("24/12/2026")).toBeVisible();

    // Y la miga devuelve a la lista con su filtro.
    await crumb(page, "Tareas").click();
    await page.waitForURL(/\/tasks\?.*view=list/);
    await expect(page.getByTestId("task-row").filter({ hasText: nuevo })).toBeVisible();
  });

  test("salir con cambios sin guardar pide confirmación", async ({ page }) => {
    await login(page, geeko().owner);
    const title = await createTask(page, "Tarea con cambios");

    await page.goto("/tasks?view=list&q=" + encodeURIComponent(title));
    await page
      .locator('[data-testid="task-row"]', { hasText: title })
      .getByRole("link", { name: title })
      .click();
    await page.getByTestId("edit-task").click();
    await page.waitForURL(/\/edit/);

    await page.getByLabel("Título").fill(`${title} sin guardar`);
    await page.getByTestId("cancel-task").click();

    await expect(page.getByText("¿Descartar los cambios?")).toBeVisible();

    // Al rechazar sigue en el formulario con lo escrito intacto.
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(page.getByLabel("Título")).toHaveValue(`${title} sin guardar`);

    // Al aceptar sale sin guardar.
    await page.getByTestId("cancel-task").click();
    await page.getByTestId("confirm-discard").click();
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}(\?.*)?$/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });

  test("salir sin cambios no pregunta nada", async ({ page }) => {
    await login(page, geeko().owner);
    const title = await createTask(page, "Tarea sin tocar");

    await page.goto("/tasks?view=list&q=" + encodeURIComponent(title));
    await page
      .locator('[data-testid="task-row"]', { hasText: title })
      .getByRole("link", { name: title })
      .click();
    await page.getByTestId("edit-task").click();
    await page.waitForURL(/\/edit/);

    await page.getByTestId("cancel-task").click();

    await expect(page.getByText("¿Descartar los cambios?")).toHaveCount(0);
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}(\?.*)?$/);
  });

  test("el título vacío se impide en la pantalla", async ({ page }) => {
    await login(page, geeko().owner);
    const title = await createTask(page, "Tarea sin título");

    await page.goto("/tasks?view=list&q=" + encodeURIComponent(title));
    await page
      .locator('[data-testid="task-row"]', { hasText: title })
      .getByRole("link", { name: title })
      .click();
    await page.getByTestId("edit-task").click();
    await page.waitForURL(/\/edit/);

    await page.getByLabel("Título").fill("");
    await page.getByTestId("save-task").click();

    await expect(page.getByText("El título no puede quedar vacío.")).toBeVisible();
    // No navegó: sigue en la edición.
    expect(page.url()).toContain("/edit");
  });

  test("marcar una casilla del cuerpo no exige entrar a editar", async ({ page }) => {
    await login(page, geeko().owner);
    const title = await createTask(page, "Tarea con casillas");

    await page.goto("/tasks?view=list&q=" + encodeURIComponent(title));
    await page
      .locator('[data-testid="task-row"]', { hasText: title })
      .getByRole("link", { name: title })
      .click();
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}(\?.*)?$/);

    // El cuerpo se escribe abriendo su editor, y se lee al guardarlo.
    await page.getByTestId("write-body").click();
    await page.getByLabel("Descripción").fill("- [ ] Tornear\n- [ ] Hornear");
    await page.getByTestId("save-body").click();
    await expect(page.getByTestId("edit-body")).toBeVisible();

    // Y las casillas se marcan desde esa lectura, sin abrir nada.
    await expect(page.locator("[data-checklist-index]")).toHaveCount(2);
    await toggleChecklist(page, 0);

    // Persiste sin haber pasado por el formulario de la tarea.
    await page.reload();
    await expect(page.locator("[data-checklist-index]").first()).toBeChecked();
    expect(page.url()).not.toContain("/edit");
  });
});

test.describe("edición de tarea · lo que no se puede editar", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "se llega desde el tablero, que es de escritorio");

  test("una tarea archivada explica su estado y no ofrece formulario", async ({
    page,
  }) => {
    await login(page, geeko().owner);
    const title = await createTask(page, "Tarea que se archiva");

    // No hay afordancia de archivar tarea en la interfaz todavía: se archiva
    // por el mismo camino que la aplicación —como la dueña, bajo RLS—.
    const db = await signedInClient(geeko().owner);
    const { data, error } = await db
      .from("tasks")
      .select("id")
      .eq("organization_id", geeko().organizationId)
      .eq("title", title)
      .single();
    if (error) throw new Error(`tarea: ${error.message}`);
    await db
      .from("tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data!.id);

    await page.goto(`/tasks/${data!.id}/edit`);

    await expect(page.getByText("Una tarea archivada no se edita")).toBeVisible();
    await expect(page.getByTestId("save-task")).toHaveCount(0);
    // Y conserva sus migas.
    await expect(crumb(page, "Tareas")).toBeVisible();
    await expect(crumb(page, title)).toBeVisible();
  });

  test("el ayudante no alcanza la edición de una línea que no tiene", async ({
    page,
  }) => {
    const copia = geeko();
    await login(page, copia.owner);
    const title = await createTask(page, "Tarea fuera del alcance");

    const db = await signedInClient(copia.owner);
    const { data: tarea } = await db
      .from("tasks")
      .select("id, business_line_id")
      .eq("organization_id", copia.organizationId)
      .eq("title", title)
      .single();

    // Se restringe a la ayudante a **otra** línea: sin líneas declaradas las
    // alcanzaría todas (`has_line_access`, rama a).
    const { data: otra } = await db
      .from("business_lines")
      .select("id")
      .eq("organization_id", copia.organizationId)
      .eq("is_shared", false)
      .neq("id", tarea!.business_line_id)
      .limit(1)
      .single();

    const { data: usuarios } = await db.auth.getUser();
    const { data: membresia } = await db
      .from("memberships")
      .select("id, user_id")
      .eq("organization_id", copia.organizationId)
      .neq("user_id", usuarios.user!.id)
      .limit(1)
      .single();

    await db.from("membership_lines").insert({
      membership_id: membresia!.id,
      business_line_id: otra!.id,
      organization_id: copia.organizationId,
    });

    // Y ahora, como la ayudante, la dirección no responde.
    await page.context().clearCookies();
    await login(page, copia.assistant);
    await page.goto(`/tasks/${tarea!.id}/edit`);

    await expect(page.getByTestId("save-task")).toHaveCount(0);
    await expect(page.getByText(/no encontrada|no existe|404/i).first()).toBeVisible();
  });
});

test.describe("edición de tarea · pantalla completa en el celular", () => {
  test.skip(({ isMobile }) => !isMobile, "es la comprobación del viewport de 390 px");

  test("no se rinde la barra inferior ni hay desplazamiento horizontal", async ({
    page,
  }) => {
    const copia = geeko();
    await login(page, copia.owner);

    /**
     * En el celular la puerta de las tareas es *Mis pendientes*, y ahí solo
     * aparece lo asignado a quien mira. La tarea se siembra por el mismo
     * camino que la aplicación —como la dueña, bajo RLS— porque el tablero,
     * que es donde está el alta rápida, no se rinde en este viewport.
     */
    const db = await signedInClient(copia.owner);
    const { data: quien } = await db.auth.getUser();
    const { data: linea } = await db
      .from("business_lines")
      .select("id")
      .eq("organization_id", copia.organizationId)
      .is("archived_at", null)
      .limit(1)
      .single();

    const title = `Tarea de celular ${Date.now()}`;
    const { error } = await db.from("tasks").insert({
      organization_id: copia.organizationId,
      business_line_id: linea!.id,
      title,
      assignee_id: quien.user!.id,
      due_at: new Date().toISOString(),
    });
    if (error) throw new Error(`tarea: ${error.message}`);

    await page.goto("/my-tasks");
    await page
      .locator("[data-testid^='pending-']")
      .filter({ hasText: title })
      .getByRole("link", { name: title })
      .click();
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}(\?.*)?$/);

    await page.getByTestId("edit-task").click();
    await page.waitForURL(/\/edit/);

    await expect(page.getByTestId("bottom-bar")).toHaveCount(0);

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborde).toBe(false);
  });
});
