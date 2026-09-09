import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";
const GEEKO_ASSISTANT = "ayudante@kamay.test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/**
 * Crea un insumo propio y devuelve su nombre y su dirección.
 *
 * **Cada prueba crea el suyo.** Trabajar sobre los insumos sembrados haría que
 * dos pruebas en paralelo —y las hay: escritorio y móvil corren a la vez
 * contra la misma base— se pisaran el saldo, que es justo lo que estas pruebas
 * miden. Es el mismo criterio que la convención pgTAP de crear la propia
 * organización en cada prueba.
 */
async function createSupply(
  page: Page,
  options: { minStock?: string } = {},
): Promise<{ name: string; url: string }> {
  const name = uniqueName("Insumo");

  await page.goto("/catalog?kind=supply");
  await page.getByRole("button", { name: "Nuevo ítem" }).click();

  const form = page.getByTestId("item-form");
  await form.getByLabel("Nombre").fill(name);
  if (options.minStock) await form.getByLabel("Mínimo").fill(options.minStock);
  await form.getByRole("button", { name: "Crear ítem" }).click();

  const row = page.getByTestId("catalog-row").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Acciones" }).click();
  await page.getByRole("menuitem", { name: "Ver" }).click();
  await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);

  return { name, url: page.url() };
}

/** El saldo que muestra el detalle, como número. */
async function balanceOf(page: Page): Promise<number> {
  const text = await page.getByTestId("balance-value").innerText();
  return Number(text.replace(/[^\d.-]/g, ""));
}

async function consume(page: Page, quantity: string, note?: string) {
  await page.getByRole("button", { name: "Registrar consumo" }).click();
  await page.getByLabel("Cantidad").fill(quantity);
  if (note) await page.getByLabel("Nota").fill(note);
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByTestId("consumption-form")).toHaveCount(0);
}

async function count(page: Page, counted: string) {
  await page.getByRole("button", { name: "Ajuste por conteo" }).click();
  await page.getByLabel("Cantidad contada").fill(counted);
  await page.getByRole("button", { name: "Guardar conteo" }).click();
}

test.describe("inventario suave (KAM-18)", () => {
  /**
   * El recorrido del backlog: compra → consumo → ajuste, verificando el saldo
   * contra la suma manual en cada paso.
   *
   * La entrada llega por la compra, que es la única vía automática: el insumo
   * nace con saldo cero y sube solo al registrarla.
   */
  test("compra, consumo y ajuste: el saldo cuadra en cada paso", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    const supply = await createSupply(page);

    // Un insumo sin movimientos aparece con saldo cero, no ausente.
    await expect.poll(() => balanceOf(page)).toBe(0);

    // ── Compra: 50 entran solas ───────────────────────────────────────────
    await page.goto("/expenses/purchases/new");

    const supplier = uniqueName("Proveedor");
    await page.getByLabel("Proveedor").fill(supplier);
    await page.getByRole("button", { name: `Crear «${supplier}»` }).click();
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await expect(page.getByText("Seleccionado:")).toContainText(supplier);

    await page.getByLabel("Agregar insumo o activo").fill(supply.name);
    await page.getByRole("button", { name: new RegExp(supply.name) }).click();
    const linea = page.getByTestId("purchase-line-row").nth(0);
    await linea.getByLabel("Cantidad").fill("50");
    await linea.getByLabel("Precio unitario").fill("8.50");

    // El selector global está en «Todas», así que la línea hay que elegirla:
    // todo egreso pertenece a una. El insumo es compartido y entra igual.
    // Por rol y no por etiqueta: la cabecera lleva un botón con el mismo
    // rótulo —el selector global de línea— y `getByLabel` no sabría cuál.
    await page.getByRole("combobox", { name: "Línea de negocio" }).click();
    await page.getByRole("option", { name: "Sublimación" }).click();

    await page.getByTestId("save-purchase").click();
    await page.waitForURL(/\/expenses(\?.*)?$/);

    await page.goto(supply.url);
    await expect
      .poll(() => balanceOf(page), { message: "la compra genera su entrada sola" })
      .toBe(50);
    await expect(page.getByTestId("item-movements")).toContainText("Entrada por compra");

    // ── Consumo: 50 − 7 = 43 ──────────────────────────────────────────────
    await consume(page, "7");
    await expect
      .poll(() => balanceOf(page), { message: "el saldo baja con el consumo" })
      .toBe(43);
    await expect(page.getByTestId("item-movements")).toContainText("Consumo");
    await expect(page.getByTestId("item-movements")).toContainText("-7");

    // ── Ajuste: el saldo pasa al valor contado ────────────────────────────
    await count(page, "40");
    await expect(page.getByTestId("count-form")).toHaveCount(0);
    await expect
      .poll(() => balanceOf(page), { message: "el saldo pasa al valor contado" })
      .toBe(40);
    await expect(page.getByTestId("item-movements")).toContainText("Ajuste por conteo");
  });

  /**
   * Criterio nº 3 del backlog: registrar un consumo toma tres interacciones o
   * menos, contadas desde que el diálogo está a la vista.
   */
  test("registrar un consumo toma tres interacciones o menos", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await createSupply(page);
    await count(page, "20"); // saldo de partida, sin contar como interacción
    await expect.poll(() => balanceOf(page)).toBe(20);

    let interacciones = 0;

    await page.getByRole("button", { name: "Registrar consumo" }).click();
    interacciones += 1; // 1 · abrir el diálogo

    await page.getByLabel("Cantidad").fill("2");
    interacciones += 1; // 2 · escribir la cantidad

    await page.getByRole("button", { name: "Registrar" }).click();
    interacciones += 1; // 3 · confirmar

    await expect.poll(() => balanceOf(page)).toBe(18);
    expect(
      interacciones,
      `el consumo tomó ${interacciones} interacciones`,
    ).toBeLessThanOrEqual(3);
  });

  // Escenarios "No se pide explicación" y "Conteo que coincide con el saldo".
  test("el conteo no pide motivo, y si coincide lo dice sin fallar", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await createSupply(page);

    await page.getByRole("button", { name: "Ajuste por conteo" }).click();

    // Ningún campo de motivo, ni obligatorio ni opcional.
    await expect(page.getByLabel(/motivo/i)).toHaveCount(0);
    await expect(page.getByLabel(/justificaci/i)).toHaveCount(0);

    // El insumo nace en cero: contar cero coincide con el saldo.
    await page.getByLabel("Cantidad contada").fill("0");
    await page.getByRole("button", { name: "Guardar conteo" }).click();

    await expect(page.getByTestId("count-unchanged")).toBeVisible();
    await expect(page.getByText("No se pudo registrar")).toHaveCount(0);
  });

  // Escenario "Corregir es registrar de nuevo": un movimiento no se edita ni
  // se borra, así que el error queda a la vista junto a su corrección.
  test("un consumo duplicado se corrige con un ajuste, y ambos quedan a la vista", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await createSupply(page);
    await count(page, "30");
    await expect.poll(() => balanceOf(page)).toBe(30);

    // El mismo consumo anotado dos veces, con una nota que lo identifica.
    await consume(page, "4", "Duplicado de prueba");
    await consume(page, "4", "Duplicado de prueba");
    await expect.poll(() => balanceOf(page)).toBe(22);
    await expect(
      page.getByTestId("item-movements").getByText("Duplicado de prueba"),
    ).toHaveCount(2);

    // Se corrige contando lo que de verdad hay: solo salieron 4.
    await count(page, "26");
    await expect.poll(() => balanceOf(page)).toBe(26);

    // Y el error sigue ahí, junto a su corrección.
    await expect(
      page.getByTestId("item-movements").getByText("Duplicado de prueba"),
    ).toHaveCount(2);
    await expect(page.getByTestId("item-movements")).toContainText("Ajuste por conteo");
  });

  // Escenarios "Cruzar el mínimo enciende las dos alertas", "Volver por encima
  // del mínimo apaga la alerta" y "De la alerta al insumo".
  test("cruzar el mínimo enciende panel y catálogo, y volver por encima los apaga", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    const supply = await createSupply(page, { minStock: "10" });

    // Nace en cero, que ya está bajo su mínimo de 10.
    await expect(page.getByTestId("balance-below-min")).toBeVisible();

    await page.goto("/dashboard");
    const card = page.getByTestId("low-stock-card");
    await expect(card).toContainText(supply.name);

    await page.goto("/catalog?kind=supply");
    await expect(
      page.getByTestId("catalog-row").filter({ hasText: supply.name }),
    ).toContainText("Bajo mínimo");

    // De la alerta del panel al detalle del insumo.
    await page.goto("/dashboard");
    await card.getByRole("link", { name: supply.name }).click();
    await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);

    // Un conteo por encima del mínimo apaga las dos.
    await count(page, "40");
    await expect.poll(() => balanceOf(page)).toBe(40);
    await expect(page.getByTestId("balance-below-min")).toHaveCount(0);

    await page.goto("/dashboard");
    await expect(page.getByTestId("low-stock-card")).not.toContainText(supply.name);

    await page.goto("/catalog?kind=supply");
    await expect(
      page.getByTestId("catalog-row").filter({ hasText: supply.name }),
    ).not.toContainText("Bajo mínimo");
  });

  // Escenarios "El ayudante no ve precios de compra" y "El ayudante registra
  // consumo": el recorte lo hace RLS, no una condición en la interfaz.
  test("el ayudante registra consumo y no ve ninguna cifra de compra", async ({ page }) => {
    await login(page, GEEKO_ASSISTANT);

    const supply = await createSupply(page);

    await expect(page.getByTestId("item-balance")).toBeVisible();
    await expect(page.getByTestId("item-movements")).toBeVisible();
    await expect(page.getByTestId("item-price-history")).toHaveCount(0);
    await expect(page.getByText(/evolución de precios/i)).toHaveCount(0);

    await count(page, "12");
    await expect.poll(() => balanceOf(page)).toBe(12);

    await consume(page, "5");
    await expect.poll(() => balanceOf(page)).toBe(7);

    expect(supply.name).toBeTruthy();
  });
});
