import { chooseOption, chooseRowAction, visibleRows } from "./helpers/data-table";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

/**
 * Cambio `item-categories`: la dueña define las categorías de ítem en
 * Configuración, por tipo, y el catálogo las usa en el formulario y en el
 * filtro. Cada prueba trabaja sobre su propia copia de Geeko Store.
 */

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";

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

async function createCategory(page: Page, kindTitle: string, name: string) {
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  const dialog = page.getByRole("dialog", { name: kindTitle });
  await dialog.getByLabel("Nombre").fill(name);
  await dialog.getByRole("button", { name: "Crear categoría" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(visibleRows(page, "itemCategory-row").filter({ hasText: name })).toHaveCount(1);
}

async function createSupply(page: Page, name: string, category: string) {
  await page.goto("/catalog?kind=supply");
  await page.getByRole("button", { name: "Nuevo insumo" }).click();
  const form = page.getByTestId("item-form");
  await form.getByLabel("Nombre").fill(name);
  await chooseOption(form, "Categoría", category);
  await form.getByRole("button", { name: "Crear insumo" }).click();
  await expect(page.getByTestId("item-form")).toHaveCount(0);
  await expect(page.getByTestId("catalog-row").filter({ hasText: name })).toHaveCount(1);
}

async function openItem(page: Page, name: string) {
  const row = page.getByTestId("catalog-row").filter({ hasText: name });
  await row.getByRole("button", { name: "Acciones" }).click();
  await page.getByRole("menuitem", { name: "Ver" }).click();
  await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);
}

test.describe("categorías de ítem", () => {
  test("la dueña las define por tipo, las asigna, filtra por ellas y archiva sin perderlas", async ({
    page,
  }) => {
    await login(page, geeko().owner);
    const tintas = uniqueName("Tintas");
    const insumo = uniqueName("Tinta cian");

    // ── Una categoría se crea en la pestaña elegida ───────────────────────
    await page.goto("/settings/item-categories");
    await expect(page.getByRole("link", { name: "Categorías de ítem" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await createCategory(page, "Nueva categoría de insumo", tintas);

    await page.getByRole("radio", { name: "Productos" }).click();
    await page.waitForURL(/kind=product/);
    await expect(visibleRows(page, "itemCategory-row").filter({ hasText: tintas })).toHaveCount(0);

    // ── El mismo nombre en otro tipo ──────────────────────────────────────
    // «Embalaje» ya existe en Insumos y en Productos; en Activos también cabe.
    await page.getByRole("radio", { name: "Activos" }).click();
    await page.waitForURL(/kind=asset/);
    await createCategory(page, "Nueva categoría de activo", "Embalaje");

    // ── Asignarla a un insumo y filtrar por ella ──────────────────────────
    await createSupply(page, insumo, tintas);

    await chooseOption(page, "Categoría", tintas);
    await page.waitForURL(/category=/);
    await expect(page.getByTestId("catalog-row")).toHaveCount(1);
    await expect(page.getByTestId("catalog-row")).toContainText(insumo);

    // ── Archivarla: el insumo la conserva, el formulario ya no la ofrece ──
    await page.goto("/settings/item-categories?kind=supply");
    await chooseRowAction(page, "itemCategory-row", tintas, "Archivar");
    await page.getByRole("alertdialog").getByRole("button", { name: "Archivar" }).click();
    await expect(
      visibleRows(page, "itemCategory-archived-row").filter({ hasText: tintas }),
    ).toHaveCount(1);

    await page.goto("/catalog?kind=supply");
    await openItem(page, insumo);
    await expect(page.getByTestId("item-category")).toContainText(tintas);
    await expect(page.getByTestId("item-category")).toContainText("Archivada");

    await page.goto("/catalog?kind=supply");
    await page.getByRole("button", { name: "Nuevo insumo" }).click();
    await page.getByTestId("item-form").getByLabel("Categoría", { exact: true }).click();
    await expect(page.getByRole("option", { name: "Sustratos", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: tintas })).toHaveCount(0);
  });

  test("el ayudante elige una categoría pero no ve dónde se definen", async ({ page }) => {
    await login(page, geeko().assistant);
    const insumo = uniqueName("Papel satinado");

    await expect(page.getByRole("link", { name: "Categorías de ítem" })).toHaveCount(0);

    await createSupply(page, insumo, "Sustratos");
    await openItem(page, insumo);
    await expect(page.getByTestId("item-category")).toHaveText("Sustratos");
  });
});
