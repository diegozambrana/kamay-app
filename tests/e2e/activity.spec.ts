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

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/**
 * KAM-22 · V23 · Bitácora de actividad.
 *
 * Escenarios del delta spec `activity-screen`:
 *   § Los filtros se aplican en la consulta y viven en la dirección →
 *     «El filtro se aplica en la consulta», «El filtro se comparte por
 *     enlace», «Volver atrás recupera el filtro anterior».
 *   § La fila expandida muestra el antes y el después → «Solo los campos que
 *     cambiaron», «Ningún nombre de columna llega a la pantalla».
 *   § Un evento de archivado permite desarchivar → «Desarchivar desde el
 *     evento», «El desarchivado se registra».
 *   § La cabecera declara que la bitácora no se edita.
 */
test.describe("bitácora de actividad", () => {
  test.skip(({ isMobile }) => isMobile, "V23 es una pantalla de escritorio");

  test("la cabecera declara la inmutabilidad y la retención vigente", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/activity");

    const aviso = page.getByTestId("activity-notice");
    await expect(aviso).toContainText("no puede editarse ni borrarse");
    await expect(page.getByTestId("retention-months")).toHaveText("12 meses");
  });

  // Scenario: El filtro se aplica en la consulta
  // Scenario: El filtro se comparte por enlace
  // Scenario: Volver atrás recupera el filtro anterior
  test("filtrar deja el filtro en la dirección, y volver atrás lo recupera", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/activity");
    await expect(page.getByTestId("activity-row").first()).toBeVisible();

    await page.getByLabel("Tipo de registro").click();
    await page.getByRole("option", { name: "Ítem", exact: true }).click();
    await page.waitForURL(/type=items/);

    const filas = page.getByTestId("activity-row");
    await expect(filas.first()).toContainText("el ítem");

    // Compartir el enlace reproduce el mismo resultado en una carga limpia.
    const compartido = page.url();
    await page.goto(compartido);
    await expect(page.getByTestId("activity-row").first()).toContainText("el ítem");

    // Y volver atrás recupera el filtro anterior, que era ninguno.
    await page.goBack();
    await expect(page).toHaveURL(/\/activity(\?.*)?$/);
  });

  // Scenario: Solo los campos que cambiaron
  // Scenario: Ningún nombre de columna llega a la pantalla
  test("la fila se despliega con el antes y el después en español", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/activity?type=items");

    const primera = page.getByTestId("activity-row").first();
    await primera.getByTestId("activity-expand").click();

    const detalle = primera.getByTestId("activity-detail");
    await expect(detalle).toBeVisible();
    await expect(detalle).toContainText("Solo se muestran los campos que cambiaron");

    // Cabeceras en el idioma del producto, no de la base.
    await expect(detalle.getByRole("columnheader", { name: "Campo" })).toBeVisible();
    await expect(detalle.getByRole("columnheader", { name: "Antes" })).toBeVisible();
    await expect(detalle.getByRole("columnheader", { name: "Después" })).toBeVisible();

    // Ningún nombre de columna se cuela en las filas del diff.
    const texto = (await detalle.innerText()).toLowerCase();
    for (const columna of ["business_line_id", "sale_price", "created_at", "unit_id"]) {
      expect(texto).not.toContain(columna);
    }
  });

  // Scenario: Desarchivar desde el evento
  // Scenario: El desarchivado se registra
  test("desarchivar desde el evento devuelve el registro y queda registrado", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    // Un contacto propio de esta corrida, para no depender de la semilla ni
    // pisar a otra prueba. El montaje es el de `archive-restore.spec.ts`.
    const nombre = uniqueName("Proveedor bitácora");
    await page.goto("/contacts");
    await page.getByRole("button", { name: "Nuevo contacto" }).click();
    const form = page.getByTestId("contact-form");
    await form.getByLabel("Nombre").fill(nombre);
    await form.getByLabel("Proveedor").check();
    await form.getByRole("button", { name: "Crear contacto" }).click();

    const fila = page.getByTestId("contact-row").filter({ hasText: nombre });
    await expect(fila).toHaveCount(1);
    await fila.click();

    // Archivarlo.
    await page
      .getByTestId("contact-detail")
      .getByRole("button", { name: "Archivar" })
      .click();
    await page
      .getByTestId("archive-warning")
      .getByRole("button", { name: "Archivar" })
      .click();
    await expect(
      page.getByTestId("contact-row").filter({ hasText: nombre }),
    ).toHaveCount(0);

    // Y desarchivarlo desde su evento de archivado en la bitácora.
    // Filtrado por el nombre de este contacto y no `.first()`: otros archivos
    // e2e archivan contactos en paralelo, y la primera fila puede ser ajena.
    await page.goto("/activity?type=contacts&action=archived");
    const evento = page.getByTestId("activity-row").filter({ hasText: nombre });
    await expect(evento).toHaveCount(1);
    await expect(evento).toContainText("archivó el contacto");
    await evento.getByTestId("activity-unarchive").click();
    await expect(evento.getByText("Desarchivado")).toBeVisible();

    // El desarchivado queda registrado a su vez.
    await page.goto("/activity?type=contacts&action=unarchived");
    await expect(
      page.getByTestId("activity-row").filter({ hasText: nombre }),
    ).toContainText("desarchivó el contacto");

    // Y el contacto vuelve a estar vigente en su lista.
    await page.goto("/contacts");
    await expect(
      page.getByTestId("contact-row").filter({ hasText: nombre }),
    ).toHaveCount(1);
  });

  // Scenario: Ningún evento coincide
  test("un filtro sin resultados se distingue del vacío inicial", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/activity?q=999999999");

    await expect(page.getByTestId("activity-no-matches")).toBeVisible();
    await expect(page.getByTestId("activity-empty")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Quitar los filtros" }).first(),
    ).toBeVisible();
  });
});
