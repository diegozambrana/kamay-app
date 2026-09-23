import { chooseOption, chooseRowAction, visibleRows } from "./helpers/data-table";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Locator, type Page } from "./helpers/test";

/**
 * Cambio `catalog-custom-attributes` (KAM-31): la dueña declara los atributos
 * de una categoría, los ítems y sus variantes los llenan, el catálogo filtra
 * por ellos, y el inventario de un insumo con variantes se lleva por variante.
 * Cada prueba trabaja sobre su propia copia de Geeko Store.
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

async function openItem(page: Page, name: string) {
  await page.goto("/catalog?kind=supply");
  const row = page.getByTestId("catalog-row").filter({ hasText: name });
  await row.getByRole("button", { name: "Acciones" }).click();
  await page.getByRole("menuitem", { name: "Ver" }).click();
  await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);
  // El detalle compone varias consultas; en el servidor de desarrollo, con
  // dos proyectos a la vez, tarda más que el tiempo por omisión de `expect`.
  await expect(page.getByTestId("item-general")).toBeVisible({ timeout: 20_000 });
}

async function createAttribute(
  page: Page,
  attribute: { name: string; type: "Texto" | "Número" | "Lista" | "Color"; options?: string[]; required?: boolean; scope?: "Ítem" | "Variante" },
) {
  await page.getByRole("button", { name: "Nuevo atributo" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo atributo" });
  await dialog.getByLabel("Nombre").fill(attribute.name);
  await chooseOption(dialog, "Tipo", attribute.type);
  if (attribute.options) await dialog.getByLabel("Opciones").fill(attribute.options.join("\n"));
  if (attribute.required) await dialog.getByLabel("Obligatorio").click();
  if (attribute.scope) await chooseOption(dialog, "Aplica a", attribute.scope);
  await dialog.getByRole("button", { name: "Crear atributo" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    visibleRows(page, "itemCategoryAttribute-row").filter({ hasText: attribute.name }),
  ).toHaveCount(1);
}

async function createSupply(page: Page, name: string, category: string, brand: string) {
  await page.goto("/catalog?kind=supply");
  await page.getByRole("button", { name: "Nuevo insumo" }).click();
  const form = page.getByTestId("item-form");
  await form.getByLabel("Nombre").fill(name);
  await chooseOption(form, "Categoría", category);
  await chooseOption(form, "Marca", brand);
  await form.getByRole("button", { name: "Crear insumo" }).click();
  await expect(page.getByTestId("item-form")).toHaveCount(0);
  await expect(page.getByTestId("catalog-row").filter({ hasText: name })).toHaveCount(1);
}

async function addVariant(page: Page, name: string, color: string) {
  await page.getByRole("button", { name: "Agregar variante" }).click();
  const form = page.getByTestId("variant-form");
  await form.getByLabel("Nombre").fill(name);
  await chooseOption(form, "Color", color);
  await form.getByRole("button", { name: "Agregar variante" }).click();
  await expect(page.getByTestId("variant-form")).toHaveCount(0);
  // La lista llega con la revalidación de la página, que bajo carga tarda.
  await expect(page.getByTestId("variant-row").filter({ hasText: name })).toHaveCount(1, {
    timeout: 15_000,
  });
}

/** El saldo de una fila de variante, como número (sin la unidad). */
function variantBalance(page: Page, name: string): Promise<number> {
  return page
    .getByTestId("variant-balance-row")
    .filter({ hasText: name })
    .getByTestId("variant-balance-value")
    .innerText()
    .then((text) => Number(text.replace(/[^\d.-]/g, "")));
}

function variantRow(page: Page, name: string): Locator {
  return page.getByTestId("variant-balance-row").filter({ hasText: name });
}

/** Una compra de una línea: el insumo y su variante, que el formulario exige. */
async function buy(page: Page, item: string, variant: string, quantity: string) {
  await page.goto("/expenses/purchases/new");

  const supplier = uniqueName("Proveedor 3D");
  await page.getByLabel("Proveedor").fill(supplier);
  await page.getByRole("button", { name: `Crear «${supplier}»` }).click();
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByText("Seleccionado:")).toContainText(supplier);

  await page.getByLabel("Agregar insumo o activo").fill(item);
  await page.getByRole("button", { name: new RegExp(item) }).first().click();
  await expect(page.getByText(`Elige una variante de ${item}`)).toBeVisible();
  await page.getByRole("button", { name: variant, exact: true }).click();

  const line = page.getByTestId("purchase-line-row").nth(0);
  await line.getByLabel("Cantidad").fill(quantity);
  await line.getByLabel("Precio unitario").fill("175");

  await page.getByRole("combobox", { name: "Línea de negocio" }).click();
  await page.getByRole("option", { name: "Impresión 3D" }).click();

  await page.getByTestId("save-purchase").click();
  await page.waitForURL(/\/expenses(\?.*)?$/);
}

test.describe("atributos de catálogo (KAM-31)", () => {
  test("la dueña declara los atributos una vez, los ítems los llenan, el catálogo filtra y archivar no pierde valores", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await login(page, geeko().owner);
    const resina = uniqueName("Resina");
    const primera = uniqueName("Resina gris");
    const segunda = uniqueName("Resina blanca");

    // ── La categoría y sus atributos ──────────────────────────────────────
    await page.goto("/settings/item-categories?kind=supply");
    await page.getByRole("button", { name: "Nueva categoría" }).click();
    const categoryDialog = page.getByRole("dialog", { name: "Nueva categoría de insumo" });
    await categoryDialog.getByLabel("Nombre").fill(resina);
    await categoryDialog.getByRole("button", { name: "Crear categoría" }).click();
    await expect(categoryDialog).toHaveCount(0);

    await chooseRowAction(page, "itemCategory-row", resina, "Atributos");
    await page.waitForURL(/\/settings\/item-categories\/[0-9a-f-]{36}$/);
    const attributesUrl = page.url();
    await expect(page.getByRole("heading", { name: `Atributos de «${resina}»` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Categorías de ítem" }).first()).toBeVisible();

    // «Owner declares the attributes of a category» y «Owner creates a list
    // attribute», e2e.
    await createAttribute(page, { name: "Marca", type: "Lista", options: ["Anycubic", "Elegoo"] });
    await createAttribute(page, {
      name: "Color",
      type: "Lista",
      options: ["Gris", "Blanco"],
      required: true,
      scope: "Variante",
    });
    await expect(
      visibleRows(page, "itemCategoryAttribute-row").filter({ hasText: /^Color/ }).first(),
    ).toContainText("Variante");
    // Tipo color (design D11): sin unidad ni opciones.
    await createAttribute(page, { name: "Tono", type: "Color", scope: "Variante" });

    // ── Dos ítems de la categoría, sin volver a declarar nada ─────────────
    // «Declared once, used by every item», e2e.
    await createSupply(page, primera, resina, "Anycubic");
    await createSupply(page, segunda, resina, "Elegoo");

    // ── Variantes: el color es obligatorio ────────────────────────────────
    await openItem(page, primera);
    await expect(page.getByTestId("item-attribute")).toHaveText("MarcaAnycubic");

    await page.getByRole("button", { name: "Agregar variante" }).click();
    const variantForm = page.getByTestId("variant-form");
    await variantForm.getByLabel("Nombre").fill("Gris");
    await variantForm.getByRole("button", { name: "Agregar variante" }).click();
    // «Un atributo obligatorio sin valor no se guarda», e2e.
    await expect(variantForm.getByText("«Color» es obligatorio.")).toBeVisible();
    await chooseOption(variantForm, "Color", "Gris");
    // «Un color se elige con el selector o se escribe en hex», e2e.
    await variantForm.getByLabel("Tono", { exact: true }).fill("9e9e9e");
    await expect(variantForm.getByLabel("Elegir Tono")).toHaveValue("#9e9e9e");
    await variantForm.getByRole("button", { name: "Agregar variante" }).click();
    await expect(page.getByTestId("variant-form")).toHaveCount(0);
    await addVariant(page, "Blanco", "Blanco");
    // «El color se ve como muestra», e2e: la variante Gris lleva su muestra.
    const gris = page.getByTestId("variant-row").filter({ hasText: /^Gris/ });
    await expect(gris.getByTestId("color-swatch")).toHaveText("#9E9E9E");

    // ── Filtro por marca ──────────────────────────────────────────────────
    // «Filtrar por un atributo de lista», e2e.
    await page.goto("/catalog?kind=supply");
    await chooseOption(page, "Categoría", resina);
    await page.waitForURL(/category=/);
    await chooseOption(page, "Marca", "Anycubic");
    await page.waitForURL(/attr_/);
    await expect(page.getByTestId("catalog-row")).toHaveCount(1);
    await expect(page.getByTestId("catalog-row")).toContainText(primera);

    // ── Archivar un atributo conserva sus valores ─────────────────────────
    // «Archiving an attribute keeps its stored values», e2e.
    await page.goto(attributesUrl);
    await chooseRowAction(page, "itemCategoryAttribute-row", "Marca", "Archivar");
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("se conservan");
    await confirm.getByRole("button", { name: "Archivar" }).click();
    await expect(
      visibleRows(page, "itemCategoryAttribute-archived-row").filter({ hasText: "Marca" }),
    ).toHaveCount(1);

    await openItem(page, primera);
    await expect(page.getByTestId("item-retired-attributes")).toContainText("Anycubic");
    await page.getByRole("button", { name: "Editar", exact: true }).first().click();
    await expect(page.getByTestId("item-form").getByLabel("Marca", { exact: true })).toHaveCount(0);
    await page.getByTestId("item-form").getByRole("button", { name: "Cancelar" }).click();

    // «Restoring an attribute offers it again», e2e.
    await page.goto(attributesUrl);
    await chooseRowAction(page, "itemCategoryAttribute-archived-row", "Marca", "Restaurar");
    await page.getByRole("alertdialog").getByRole("button", { name: "Restaurar" }).click();
    await expect(
      visibleRows(page, "itemCategoryAttribute-row").filter({ hasText: "Marca" }),
    ).toHaveCount(1);

    await openItem(page, primera);
    await expect(page.getByTestId("item-attribute")).toHaveText("MarcaAnycubic");
    await expect(page.getByTestId("item-retired-attributes")).toHaveCount(0);
  });

  test("el filamento de la semilla se compra, se consume y se cuenta por color", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, geeko().owner);

    // ── Datos técnicos rotulados ──────────────────────────────────────────
    await openItem(page, "PLA Sunlu");
    const general = page.getByTestId("item-general");
    await expect(general).toContainText("Sunlu");
    await expect(general).toContainText("190 °C");
    await expect(general).toContainText("60 mm/s");
    const detail = page.url();

    // ── Una compra por color ──────────────────────────────────────────────
    await buy(page, "PLA Sunlu", "Negro", "2");
    await buy(page, "PLA Sunlu", "Rojo", "1");

    // «Disponibilidad por variante en el detalle», e2e.
    await page.goto(detail);
    await expect.poll(() => variantBalance(page, "Negro")).toBe(2);
    await expect.poll(() => variantBalance(page, "Rojo")).toBe(1);
    await expect(page.getByRole("button", { name: "Ajuste por conteo" })).toHaveCount(0);

    // ── Consumo desde la fila de una variante: tres interacciones ─────────
    // «Consumo desde la fila de una variante», e2e.
    let interacciones = 0;
    await variantRow(page, "Negro").getByRole("button", { name: "Registrar consumo" }).click();
    interacciones += 1; // 1 · abrir el diálogo con la variante puesta
    await page.getByTestId("consumption-form").getByLabel("Cantidad").fill("0.3");
    interacciones += 1; // 2 · escribir la cantidad
    await page.getByTestId("consumption-form").getByRole("button", { name: "Registrar" }).click();
    interacciones += 1; // 3 · confirmar
    await expect(page.getByTestId("consumption-form")).toHaveCount(0);
    expect(interacciones).toBeLessThanOrEqual(3);

    await expect.poll(() => variantBalance(page, "Negro")).toBe(1.7);
    await expect.poll(() => variantBalance(page, "Rojo")).toBe(1);

    // ── Registro rápido: elegir la variante suma una interacción ──────────
    // «Registro rápido de un ítem con variantes», e2e.
    await page.goto("/quick");
    await page.getByRole("button", { name: "Consumo" }).first().click();
    const quick = page.getByTestId("consumption-form");
    await expect(quick).toBeVisible();
    let rapidas = 0;
    await chooseOption(quick, "Insumo", "PLA Sunlu");
    rapidas += 1; // 1 · el insumo
    await quick.getByRole("radio", { name: "Rojo" }).click();
    rapidas += 1; // 2 · la variante
    await quick.getByLabel("Cantidad").fill("0.5");
    rapidas += 1; // 3 · la cantidad
    await quick.getByRole("button", { name: "Registrar" }).click();
    rapidas += 1; // 4 · confirmar
    await expect(page.getByTestId("consumption-form")).toHaveCount(0);
    expect(rapidas).toBe(4);

    await page.goto(detail);
    await expect.poll(() => variantBalance(page, "Rojo")).toBe(0.5);
    await expect.poll(() => variantBalance(page, "Negro")).toBe(1.7);

    // ── Conteo de un color ────────────────────────────────────────────────
    // «Conteo de una variante», e2e.
    await variantRow(page, "Negro").getByRole("button", { name: "Ajustar" }).click();
    const count = page.getByTestId("count-form");
    await expect(count).toContainText("PLA Sunlu · Negro");
    await count.getByLabel("Cantidad contada").fill("1.5");
    await count.getByRole("button", { name: "Guardar conteo" }).click();
    await expect(page.getByTestId("count-form")).toHaveCount(0);

    await expect.poll(() => variantBalance(page, "Negro")).toBe(1.5);
    await expect.poll(() => variantBalance(page, "Rojo")).toBe(0.5);
    await expect(page.getByTestId("item-movements")).toContainText("Negro");
  });

  test("el ayudante llena los atributos pero no llega a definirlos", async ({ page }) => {
    await login(page, geeko().assistant);
    const nombre = uniqueName("PETG");

    // «El ayudante llena los atributos», e2e.
    await createSupply(page, nombre, "Filamento", "eSun");
    await openItem(page, nombre);
    await expect(page.getByTestId("item-attribute")).toHaveText("MarcaeSun");
    await addVariant(page, "Blanco", "Blanco");
    await expect(page.getByTestId("variant-attribute")).toHaveText("Blanco");

    // «The assistant cannot reach the attributes».
    await page.goto("/settings/item-categories/92000000-0000-0000-0000-000000000004");
    await expect(page).toHaveURL(/\/(auth\/login|dashboard|quick)(\?.*)?$/);
  });
});
