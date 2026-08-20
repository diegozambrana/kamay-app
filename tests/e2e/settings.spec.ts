import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test"; // dueña de Geeko Store
const GEEKO_ASSISTANT = "ayudante@kamay.test"; // ayudante de Geeko Store

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
    await login(page, GEEKO_OWNER);

    await page.goto("/settings/lines");
    const name = uniqueName("Serigrafía");
    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("Color").selectOption("green");
    await page.getByRole("button", { name: "Crear línea" }).click();

    await expect(page.getByTestId("line-list").getByText(name)).toBeVisible();

    // Disponible de inmediato en el selector global, sin volver a entrar.
    await page.getByTestId("line-selector").click();
    const option = page.getByRole("menuitem", { name });
    await expect(option).toBeVisible();
    await expect(option.locator("span").first()).toHaveClass(/bg-green-500/);
  });

  test("la selección de línea se conserva al cambiar de sección y entre sesiones", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

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
    await login(page, GEEKO_OWNER);
    await expect(page.getByTestId("line-selector")).toContainText("Alfarería");
  });

  test("la línea compartida no ofrece archivar", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/settings/lines");

    const general = page.getByTestId("line-list").getByRole("listitem").filter({
      hasText: "General",
    });
    await expect(general.getByRole("button", { name: "Editar" })).toBeVisible();
    await expect(general.getByRole("button", { name: "Archivar" })).toHaveCount(0);
  });

  test("la línea archivada desaparece del selector", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/settings/lines");

    const name = uniqueName("Temporal");
    await page.getByLabel("Nombre").fill(name);
    await page.getByRole("button", { name: "Crear línea" }).click();
    const row = page.getByTestId("line-list").getByRole("listitem").filter({
      hasText: name,
    });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Archivar" }).click();
    await expect(page.getByText("Archivados")).toBeVisible();

    await page.getByTestId("line-selector").click();
    await expect(page.getByRole("menuitem", { name })).toHaveCount(0);
  });

  test("las secciones de V15 están todas presentes", async ({ page }) => {
    await login(page, GEEKO_OWNER);
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

test.describe("configuración cerrada al ayudante", () => {
  test.skip(({ isMobile }) => isMobile, "V15 es una pantalla de escritorio");

  test("el ayudante que entra por dirección directa termina fuera", async ({
    page,
  }) => {
    await login(page, GEEKO_ASSISTANT);

    await page.goto("/settings");
    await expect(page).not.toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: "Configuración" })).toHaveCount(0);

    await page.goto("/settings/lines");
    await expect(page).not.toHaveURL(/\/settings/);
  });

  test("el ayudante no tiene la entrada de configuración en su menú", async ({
    page,
  }) => {
    await login(page, GEEKO_ASSISTANT);

    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Panel" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Configuración" })).toHaveCount(0);
  });
});
