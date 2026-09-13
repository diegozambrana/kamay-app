import { createFreshOrganization, E2E_PASSWORD, signedInClient } from "./helpers/fresh-org";
import { rendimiento } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

// «Kamay Rendimiento»: 624 pedidos, 70 contactos y unos 3.800 eventos de
// bitácora (supabase/seeds/performance.sql). Suficiente para que toda lista
// tenga más de una vuelta.

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * KAM-23 · Ninguna vista carga una tabla entera (spec `performance-budget`).
 *
 * Escenarios: *No data view loads an entire table* → «A list requests a
 * bounded page», «The activity log is never loaded whole».
 */
test.describe("listas acotadas", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "la paginación no depende del dispositivo");

  test("los pedidos traen lo abierto y una vuelta de cerrados, y «Mostrar más» amplía", async ({
    page,
  }) => {
    await login(page, rendimiento().owner);
    await page.goto("/orders?view=list");

    const rows = page.getByTestId("order-row");
    await expect(rows.first()).toBeVisible();
    const firstWindow = await rows.count();
    // 24 abiertos (dos semanas × 4 × 3 líneas) y 50 cerrados: ni uno más.
    expect(firstWindow).toBeLessThanOrEqual(24 + 50);

    const more = page.getByTestId("load-more");
    await expect(more).toContainText("50 cerrados");
    await more.getByRole("button", { name: "Mostrar más" }).click();

    await expect(page).toHaveURL(/[?&]closed=100/);
    await expect.poll(() => rows.count()).toBeGreaterThan(firstWindow);
    expect(await rows.count()).toBeLessThanOrEqual(24 + 100);
  });

  test("el directorio trae una vuelta y ofrece el resto", async ({ page }) => {
    await login(page, rendimiento().owner);
    await page.goto("/contacts");

    const rows = page.getByTestId("contact-row");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBe(50);

    await page.getByTestId("load-more").getByRole("button", { name: "Mostrar más" }).click();
    await expect(page).toHaveURL(/[?&]limit=100/);
    // Setenta contactos en la semilla: la segunda vuelta los trae todos y
    // ya no ofrece más.
    await expect(rows).toHaveCount(70);
    await expect(page.getByTestId("load-more")).toHaveCount(0);
  });

  test("lo recién creado aparece aunque caiga fuera de la primera vuelta", async ({ page }) => {
    // Una organización propia con más de una vuelta de insumos: la ventana es
    // alfabética y «Zz…» cae después de todos.
    const organization = await createFreshOrganization();
    const owner = await signedInClient(organization.email);
    const { error } = await owner.from("items").insert(
      Array.from({ length: 55 }, (_, index) => ({
        organization_id: organization.organizationId,
        kind: "supply",
        name: `Insumo ${String(index + 1).padStart(3, "0")}`,
      })),
    );
    if (error) throw new Error(`insumos: ${error.message}`);

    await login(page, organization.email);
    await page.goto("/catalog?kind=supply");
    await expect(page.getByTestId("catalog-row")).toHaveCount(50);

    const nombre = `Zz recién creado ${Date.now()}`;
    await page.getByRole("button", { name: "Nuevo ítem" }).click();
    await page.getByTestId("item-form").getByLabel("Nombre").fill(nombre);
    await page.getByTestId("item-form").getByRole("button", { name: "Crear ítem" }).click();

    // Se ve al final de la lista, y el resto sigue ofreciéndose.
    await expect(page.getByTestId("catalog-row").last()).toContainText(nombre);
    await expect(page.getByTestId("load-more")).toBeVisible();
  });

  test("un contacto nuevo aparece y se abre aunque caiga fuera de la primera vuelta", async ({
    page,
  }) => {
    const organization = await createFreshOrganization();
    const owner = await signedInClient(organization.email);
    const { error } = await owner.from("contacts").insert(
      Array.from({ length: 55 }, (_, index) => ({
        organization_id: organization.organizationId,
        name: `Cliente ${String(index + 1).padStart(3, "0")}`,
        is_customer: true,
        is_supplier: false,
      })),
    );
    if (error) throw new Error(`contactos: ${error.message}`);

    await login(page, organization.email);
    await page.goto("/contacts");
    await expect(page.getByTestId("contact-row")).toHaveCount(50);

    const nombre = `Zz contacto nuevo ${Date.now()}`;
    await page.getByRole("button", { name: "Nuevo contacto" }).click();
    const form = page.getByTestId("contact-form");
    await form.getByLabel("Nombre").fill(nombre);
    await form.getByLabel("Cliente").check();
    await form.getByRole("button", { name: "Crear contacto" }).click();

    await expect(page.getByTestId("contact-row").last()).toContainText(nombre);
    await expect(page.getByTestId("contact-detail")).toContainText(nombre);
  });

  test("la bitácora se consulta por páginas, nunca entera", async ({ page }) => {
    await login(page, rendimiento().owner);
    await page.goto("/activity");

    const rows = page.getByTestId("activity-row");
    await expect(rows.first()).toBeVisible();
    // Una página, de ~3.800 eventos.
    expect(await rows.count()).toBeLessThanOrEqual(50);
    await expect(page.getByRole("link", { name: "Cargar más" })).toBeVisible();
  });
});
