import { chooseOption, chooseRowAction, visibleRows } from "./helpers/data-table";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/** Nombre único por corrida: las pruebas no se pisan entre sí ni entre navegadores. */
function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

test.describe("configuración de la organización", () => {
  test.skip(({ isMobile }) => isMobile, "V15 es una pantalla de escritorio");

  test("la línea creada queda disponible en el selector con su color", async ({
    page,
  }) => {
    await login(page, geeko().owner);

    await page.goto("/settings/lines");
    const name = uniqueName("Serigrafía");

    // Alta en un diálogo («Owner creates a line from the dialog»).
    await page.getByRole("button", { name: "Crear línea" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva línea" });
    await dialog.getByLabel("Nombre").fill(name);
    await chooseOption(dialog, "Color", "Verde");
    await dialog.getByRole("button", { name: "Crear línea" }).click();
    await expect(dialog).toBeHidden();

    await expect(visibleRows(page, "line-row").filter({ hasText: name })).toBeVisible();

    // Disponible de inmediato en el selector global, sin volver a entrar.
    await page.getByTestId("line-selector").click();
    const option = page.getByRole("menuitem", { name });
    await expect(option).toBeVisible();
    await expect(option.locator("span").first()).toHaveClass(/bg-green-500/);
  });

  test("la selección de línea se conserva al cambiar de sección y entre sesiones", async ({
    page,
  }) => {
    await login(page, geeko().owner);

    await page.getByTestId("line-selector").click();
    await page.getByRole("menuitem", { name: "Alfarería" }).click();
    await expect(page.getByTestId("line-selector")).toContainText("Alfarería");
    // El botón se rehabilita cuando la acción terminó de fijar la cookie: sin
    // esperarla, la navegación siguiente cancelaría la petición en vuelo.
    await expect(page.getByTestId("line-selector")).toBeEnabled();

    // Cambiar de sección no reinicia el contexto.
    await page.goto("/settings/channels");
    await expect(page.getByTestId("line-selector")).toContainText("Alfarería");
    await page.goto("/dashboard");
    await expect(page.getByTestId("line-selector")).toContainText("Alfarería");

    // Y sobrevive al cierre de sesión: al día siguiente sigue donde estaba.
    // Se limpian solo las cookies de sesión de Supabase: la de línea (D4) debe
    // sobrevivir, que es justamente lo que verifica el criterio.
    await page.context().clearCookies({ name: /^sb-/ });
    await login(page, geeko().owner);
    await expect(page.getByTestId("line-selector")).toContainText("Alfarería");
  });

  test("la línea compartida no ofrece archivar", async ({ page }) => {
    await login(page, geeko().owner);
    await page.goto("/settings/lines");

    // Su «⋯» ofrece editarla, no archivarla.
    const general = visibleRows(page, "line-row").filter({ hasText: "General" });
    await general.getByRole("button", { name: /^Acciones de / }).click();
    await expect(page.getByRole("menuitem", { name: "Editar" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Archivar" })).toHaveCount(0);
  });

  test("la línea archivada desaparece del selector", async ({ page }) => {
    await login(page, geeko().owner);
    await page.goto("/settings/lines");

    const name = uniqueName("Temporal");
    await page.getByRole("button", { name: "Crear línea" }).click();
    const create = page.getByRole("dialog", { name: "Nueva línea" });
    await create.getByLabel("Nombre").fill(name);
    await create.getByRole("button", { name: "Crear línea" }).click();
    await expect(create).toBeHidden();
    await expect(visibleRows(page, "line-row").filter({ hasText: name })).toBeVisible();

    // Archivar pide confirmación («Archiving a line asks first») y confirmar
    // la pasa a «Archivados» («Confirming archives»).
    await chooseRowAction(page, "line-row", name, "Archivar");
    const confirm = page.getByRole("alertdialog", { name: `¿Archivar «${name}»?` });
    await expect(confirm).toContainText("Los registros que ya la usan la siguen mostrando");
    await confirm.getByRole("button", { name: "Archivar" }).click();
    await expect(confirm).toBeHidden();
    await expect(
      visibleRows(page, "line-archived-row").filter({ hasText: name }),
    ).toBeVisible();
    await expect(visibleRows(page, "line-row").filter({ hasText: name })).toHaveCount(0);

    await page.getByTestId("line-selector").click();
    await expect(page.getByRole("menuitem", { name })).toHaveCount(0);
  });

  test("las secciones de V15 están todas presentes", async ({ page }) => {
    await login(page, geeko().owner);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/general$/);

    for (const section of [
      "General",
      "Líneas de negocio",
      "Canales",
      "Categorías",
      "Unidades",
      "Usuarios y roles",
    ]) {
      await expect(page.getByRole("link", { name: section })).toBeVisible();
    }
  });
});

/**
 * Menú lateral de secciones (spec `settings-interaction` → *Settings sections
 * are navigated from a side menu*, design D10). Se mide la disposición real
 * a cada ancho, con el mismo proyecto de escritorio y la ventana a medida.
 */
test.describe("menú de secciones de configuración", () => {
  test.skip(({ isMobile }) => isMobile, "cada prueba fija su propio ancho");

  const menu = (page: Page) =>
    page.getByRole("navigation", { name: "Secciones de configuración" });

  test("en una pantalla ancha el menú va a la izquierda del contenido", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, geeko().owner);
    await page.goto("/settings/lines");

    const nav = menu(page);
    const current = nav.getByRole("link", { name: "Líneas de negocio" });
    await expect(current).toHaveAttribute("aria-current", "page");
    for (const group of ["Organización", "Equipo", "Preferencias", "Datos"]) {
      await expect(nav.getByText(group, { exact: true })).toBeVisible();
    }

    // Columna a la izquierda, contenido a la derecha y a la misma altura.
    const navBox = (await nav.boundingBox())!;
    const heading = page.getByRole("heading", { level: 2, name: "Líneas de negocio" });
    const headingBox = (await heading.boundingBox())!;
    expect(navBox.x + navBox.width).toBeLessThanOrEqual(headingBox.x);
    expect(navBox.y).toBeLessThan(headingBox.y + headingBox.height);
  });

  test("en una pantalla muy ancha el bloque no pasa de 1280 px y sigue al título", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page, geeko().owner);
    await page.goto("/settings/lines");

    const block = (await menu(page).locator("..").boundingBox())!;
    const title = (await page.getByRole("heading", { level: 1, name: "Configuración" }).boundingBox())!;
    expect(block.width).toBeLessThanOrEqual(1280);
    expect(Math.abs(block.x - title.x)).toBeLessThanOrEqual(1);
  });

  test("en el celular el menú es una fila que se desplaza, con la sección actual a la vista", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, geeko().owner);
    await page.goto("/settings/members");

    const nav = menu(page);
    const current = nav.getByRole("link", { name: "Usuarios y roles" });
    await expect(current).toHaveAttribute("aria-current", "page");

    // Una sola fila, sin títulos de grupo.
    const first = (await nav.getByRole("link", { name: "General" }).boundingBox())!;
    await expect(nav.getByText("Organización", { exact: true })).toBeHidden();
    // La séptima sección quedó dentro de la pantalla y en la misma fila.
    await expect(async () => {
      const box = (await current.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(Math.abs(box.y - first.y)).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 5_000 });

    // La fila se desplaza ella; la página no.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});

test.describe("configuración cerrada al ayudante", () => {
  test.skip(({ isMobile }) => isMobile, "V15 es una pantalla de escritorio");

  test("el ayudante que entra por dirección directa termina fuera", async ({
    page,
  }) => {
    await login(page, geeko().assistant);

    await page.goto("/settings");
    await expect(page).not.toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: "Configuración" })).toHaveCount(0);

    await page.goto("/settings/lines");
    await expect(page).not.toHaveURL(/\/settings/);
  });

  test("el ayudante no tiene la entrada de configuración en su menú", async ({
    page,
  }) => {
    await login(page, geeko().assistant);

    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Panel" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Configuración" })).toHaveCount(0);
  });
});
