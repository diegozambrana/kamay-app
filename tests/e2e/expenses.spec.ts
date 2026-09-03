import { expect, test, type Locator, type Page } from "@playwright/test";

import { noisePng } from "./helpers/png";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";
const GEEKO_ASSISTANT = "ayudante@kamay.test";

const MB = 1024 * 1024;

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/** Fija la línea activa desde el selector global (solo escritorio). */
async function selectLine(page: Page, name: string) {
  await page.getByTestId("line-selector").click();
  await page.getByRole("menuitem", { name }).click();
  await expect(page.getByTestId("line-selector")).toContainText(name);
  await expect(page.getByTestId("line-selector")).toBeEnabled();
}

/** Un monto que no choca con ningún otro egreso: sirve para encontrar la fila. */
function uniqueAmount(): string {
  const cents = String(Math.floor(Math.random() * 90) + 10);
  return `${(Date.now() % 90000) + 1000}.${cents}`;
}

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Una fila o tarjeta de la bandeja que contenga el texto. */
function expenseEntry(page: Page, text: string): Locator {
  return page.getByTestId(/^expense-(row|card)$/).filter({ hasText: text });
}

test.describe("egresos (V7, V8, V9)", () => {
  test("registrar un gasto toma cinco interacciones o menos y aparece en la bandeja", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/expenses");

    // Se cuentan las interacciones a mano, no a ojo (criterio 8 del backlog).
    let interactions = 0;
    const tap = async (locator: Locator) => {
      interactions += 1;
      await locator.click();
    };
    const type = async (locator: Locator, text: string) => {
      interactions += 1;
      await locator.fill(text);
    };

    const amount = uniqueAmount();

    await tap(page.getByTestId("new-cost"));
    await page.waitForURL(/\/expenses\/costs\/new$/);
    // El monto ya tiene el foco: escribir es la segunda interacción.
    await expect(page.getByLabel("Monto")).toBeFocused();
    await type(page.getByLabel("Monto"), amount);
    await tap(page.getByRole("radio", { name: "Transporte" }));
    await tap(page.getByTestId("save-cost"));

    await page.waitForURL(/\/expenses(\?.*)?$/);
    expect(interactions).toBeLessThanOrEqual(5);

    const entry = expenseEntry(page, amount);
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("Gasto");
    await expect(entry).toContainText("Transporte");
  });

  test("un gasto de General no aparece con Sublimación activa y sí con Todas", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "este recorrido usa el selector de línea del menú lateral");

    await login(page, GEEKO_OWNER);
    await selectLine(page, "Todas");

    await page.goto("/expenses/costs/new");
    // Con "Todas" activa queda General preseleccionada (design D5).
    await expect(page.getByTestId("line-select")).toContainText("General");

    const amount = uniqueAmount();
    await page.getByLabel("Monto").fill(amount);
    await page.getByRole("radio", { name: "Servicios" }).click();
    await page.getByTestId("save-cost").click();
    await page.waitForURL(/\/expenses(\?.*)?$/);

    await expect(expenseEntry(page, amount)).toHaveCount(1);
    const totalWithAll = await page.getByTestId("summary-total").textContent();

    // Sublimación activa: el gasto de General ni aparece ni suma.
    await selectLine(page, "Sublimación");
    await page.goto("/expenses");
    await expect(expenseEntry(page, amount)).toHaveCount(0);
    const totalSubli = await page.getByTestId("summary-total").textContent();
    expect(Number(totalSubli)).toBeLessThan(Number(totalWithAll));

    await selectLine(page, "Todas");
    await page.goto("/expenses");
    await expect(expenseEntry(page, amount)).toHaveCount(1);
  });

  test("una compra completa: proveedor al vuelo, dos insumos, detalle, historial y archivado", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "este recorrido usa el selector de línea del menú lateral");

    await login(page, GEEKO_OWNER);
    await selectLine(page, "Sublimación");
    await page.goto("/expenses/purchases/new");

    // Proveedor nuevo, sin abandonar el formulario.
    const supplier = uniqueName("Ferretería");
    await page.getByLabel("Proveedor").fill(supplier);
    await page.getByRole("button", { name: `Crear «${supplier}»` }).click();
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await expect(page.getByText(`Seleccionado:`)).toContainText(supplier);

    // Dos insumos con cantidad y precio. La taza ya se compró antes (semilla):
    // muestra su pista y el precio nace vacío.
    await page.getByLabel("Agregar insumo").fill("Taza");
    await page.getByRole("button", { name: /Taza para sublimación/ }).click();
    const taza = page.getByTestId("purchase-line-row").nth(0);
    await expect(taza.getByTestId("last-cost-hint")).toContainText("Último: 9.20");
    await expect(taza.getByLabel("Precio unitario")).toHaveValue("");
    await taza.getByLabel("Cantidad").fill("3");
    await taza.getByLabel("Precio unitario").fill("9.20");

    await page.getByLabel("Agregar insumo").fill("Papel");
    await page.getByRole("button", { name: /Papel de transferencia/ }).click();
    const papel = page.getByTestId("purchase-line-row").nth(1);
    await papel.getByLabel("Cantidad").fill("1");
    await papel.getByLabel("Precio unitario").fill("95");

    // 3 × 9.20 + 1 × 95 = 122.60, en vivo.
    await expect(page.getByTestId("purchase-form-total")).toHaveText("122.60");

    await page.getByTestId("save-purchase").click();
    await page.waitForURL(/\/expenses(\?.*)?$/);

    // La fila y el detalle en el panel.
    const row = expenseEntry(page, supplier);
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("row-total")).toHaveText("122.60");
    await row.click();

    const detail = page.getByTestId("expense-detail");
    await expect(detail.getByTestId("expense-total")).toHaveText("122.60");
    await expect(detail.getByTestId("expense-line")).toHaveCount(2);
    await expect(detail.getByTestId("detail-supplier")).toContainText(supplier);
    await expect(
      detail.locator('[data-testid="history-entry"][data-action="created"]'),
    ).toHaveCount(1);

    // El mismo detalle por enlace directo.
    await page.getByRole("link", { name: "Abrir a página completa" }).click();
    await page.waitForURL(/\/expenses\/[0-9a-f-]{36}$/);
    const expenseUrl = page.url();
    await expect(page.getByTestId("expense-total")).toHaveText("122.60");

    // Archivar: desaparece de la bandeja, vuelve con "Ver archivados".
    await page.getByTestId("archive-expense").click();
    await page.getByTestId("confirm-archive").click();
    await expect(page.getByTestId("unarchive-expense")).toBeVisible();

    await page.goto("/expenses");
    await expect(expenseEntry(page, supplier)).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Ver archivados" }).click();
    await expect(page).toHaveURL(/archived=1/);
    const archivedRow = expenseEntry(page, supplier);
    await expect(archivedRow).toHaveCount(1);
    await expect(archivedRow).toHaveAttribute("data-archived", "true");

    // Desarchivar devuelve la compra intacta.
    await page.goto(expenseUrl);
    await page.getByTestId("unarchive-expense").click();
    await expect(page.getByTestId("archive-expense")).toBeVisible();
    await expect(page.getByTestId("expense-line")).toHaveCount(2);
    await expect(page.getByTestId("expense-total")).toHaveText("122.60");
  });

  test("sin proveedor la compra no se guarda y el campo queda señalado", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/expenses/purchases/new");

    await page.getByLabel("Agregar insumo").fill("Arcilla");
    await page.getByRole("button", { name: /Arcilla roja/ }).click();
    await page.getByTestId("purchase-line-row").getByLabel("Precio unitario").fill("38");
    await page.getByTestId("save-purchase").click();

    await expect(page.getByTestId("supplier-error")).toHaveText("Elige o crea un proveedor");
    await expect(page).toHaveURL(/\/expenses\/purchases\/new$/);
  });

  test("una foto de 8 MB se comprime bajo 5 MB y el guardado no la espera", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "la compresión de una imagen grande se mide una vez, en escritorio");
    test.setTimeout(120_000);

    await login(page, GEEKO_OWNER);
    await page.goto("/expenses/costs/new");

    const amount = uniqueAmount();
    await page.getByLabel("Monto").fill(amount);
    await page.getByRole("radio", { name: "Servicios" }).click();

    // Un PNG de ruido de 2000 × 2000: pesa unos 12 MB y el navegador lo decodifica.
    const buffer = noisePng(2000, 2000);
    expect(buffer.length).toBeGreaterThan(8 * MB);
    await page.locator('input[type="file"]').setInputFiles({
      name: "recibo-grande.png",
      mimeType: "image/png",
      buffer,
    });

    await page.getByTestId("save-cost").click();

    // La bandeja muestra el gasto sin esperar al comprobante.
    await page.waitForURL(/\/expenses(\?.*)?$/);
    const entry = expenseEntry(page, amount);
    await expect(entry).toHaveCount(1);

    // El comprobante llega después, y llega comprimido.
    await entry.click();
    const receipt = page.getByTestId("expense-receipt");
    await expect(receipt).toHaveCount(1, { timeout: 60_000 });
    const sizeBytes = Number(await receipt.getAttribute("data-size-bytes"));
    expect(sizeBytes).toBeGreaterThan(0);
    expect(sizeBytes).toBeLessThanOrEqual(5 * MB);
  });

  test("un archivo que no es una imagen se rechaza antes de guardar", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/expenses/costs/new");

    await page.locator('input[type="file"]').setInputFiles({
      name: "factura.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("no soy una foto"),
    });

    await expect(page.getByTestId("receipt-format-error")).toContainText(
      "JPEG, PNG, WebP o AVIF",
    );
  });
});

test.describe("egresos cerrados al ayudante", () => {
  test("el ayudante no tiene la entrada en su menú", async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), "el menú lateral es de escritorio");

    await login(page, GEEKO_ASSISTANT);

    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Pedidos" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Egresos" })).toHaveCount(0);
  });

  test("el ayudante que entra por dirección directa termina en su aterrizaje", async ({
    page,
  }) => {
    await login(page, GEEKO_ASSISTANT);

    await page.goto("/expenses");
    await expect(page).not.toHaveURL(/\/expenses/);
    await expect(page.getByRole("heading", { name: "Egresos" })).toHaveCount(0);

    await page.goto("/expenses/costs/new");
    await expect(page).not.toHaveURL(/\/expenses/);

    await page.goto("/expenses/purchases/new");
    await expect(page).not.toHaveURL(/\/expenses/);
  });
});
