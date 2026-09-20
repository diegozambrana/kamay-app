import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

import { createFreshOrganization, E2E_PASSWORD } from "./helpers/fresh-org";


async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * KAM-23 · Estados transversales (spec `view-states`), en el navegador.
 *
 * Escenarios:
 *   § Every data view presents an initial empty state → «Empty view offers its
 *     creation action».
 *   § Filtered-empty is distinct from initially-empty… → «Filtering to zero
 *     results shows the filtered-empty state», «Clearing filters restores the
 *     unfiltered view», «An empty organization never shows the
 *     filtered-empty state».
 *   § Every data view presents a human error state with retry → «Failed load
 *     explains itself and offers retry».
 *   § The offline indicator is not one of these states → «Losing connection
 *     does not blank the view».
 */
test.describe("estados transversales", () => {
  test("una organización vacía ve el vacío inicial con su acción, no el de filtrado", async ({
    page,
  }) => {
    const fresh = await createFreshOrganization();
    await login(page, fresh.email);

    // `archived=1` no es un filtro: ensancha. La organización sigue vacía.
    await page.goto("/orders?view=list&archived=1");

    const empty = page.getByTestId("empty-state");
    await expect(empty).toBeVisible();
    await expect(page.getByTestId("filtered-empty-state")).toHaveCount(0);

    await empty.getByRole("link", { name: "Crear pedido" }).click();
    // Lleva la vista de origen (`?from=`) para volver a ella al guardar.
    await page.waitForURL(/\/orders\/new(\?.*)?$/);
  });

  test("filtrar hasta cero ofrece quitar filtros, y quitarlos devuelve la lista", async ({
    page,
  }) => {
    await login(page, geeko().owner);
    await page.goto("/catalog?kind=supply&q=zzz-ningun-insumo-se-llama-asi");

    const filtered = page.getByTestId("filtered-empty-state");
    await expect(filtered).toBeVisible();
    await expect(page.getByTestId("empty-state")).toHaveCount(0);

    await filtered.getByRole("button", { name: "Quitar filtros" }).click();

    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(page).toHaveURL(/kind=supply/);
    await expect(page.getByTestId("catalog-row").first()).toBeVisible();
    // El campo de búsqueda también queda vacío, no solo la dirección.
    await expect(page.getByTestId("catalog-search")).toHaveValue("");
  });

  test("un fallo de carga se explica en lenguaje humano y ofrece reintentar", async ({
    page,
  }) => {
    await login(page, geeko().owner);
    // Un identificador mal formado hace fallar la consulta en el servidor:
    // es un fallo real, no uno fingido para la prueba.
    await page.goto("/orders/no-es-un-uuid");

    const error = page.getByTestId("error-state");
    await expect(error).toBeVisible();
    await expect(error).toContainText("No se pudo cargar esta sección");
    await expect(page.getByRole("heading", { name: "Pedido", level: 1 })).toBeVisible();

    // Ningún detalle técnico llega a la pantalla.
    await expect(page.locator("body")).not.toContainText(/uuid|syntax|PGRST|digest|Error:/i);

    // Reintentar vuelve a pedir el segmento sin recargar la aplicación: una
    // marca en la ventana sobrevive al reintento.
    await page.evaluate(() => {
      (window as unknown as { kamayMarker: number }).kamayMarker = 23;
    });
    await error.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByTestId("error-state")).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { kamayMarker?: number }).kamayMarker),
    ).toBe(23);
  });

  test("perder la conexión no vacía una vista que ya tiene datos", async ({
    page,
    context,
  }) => {
    await login(page, geeko().owner);
    await page.goto("/orders?view=list");
    const firstRow = page.getByTestId("order-row").first();
    await expect(firstRow).toBeVisible();
    const rows = await page.getByTestId("order-row").count();

    await context.setOffline(true);
    // Lo que `SyncProvider` haga al notar la caída —reintentar la cola,
    // refrescar— tiene tiempo de ocurrir antes de mirar.
    await page.waitForFunction(() => !navigator.onLine);

    // El indicador de KAM-11 aparece cuando hay registros por sincronizar
    // (lo prueba `offline-capture.spec.ts`); lo que se juega aquí es que la
    // caída no convierta la vista en un error ni en un vacío.
    await expect(page.getByTestId("order-row")).toHaveCount(rows);
    await expect(page.getByTestId("error-state")).toHaveCount(0);
    await expect(page.getByTestId("empty-state")).toHaveCount(0);

    await context.setOffline(false);
  });
});
