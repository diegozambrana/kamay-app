import { noisePng } from "./helpers/png";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("kamay123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/** La suma de desplazamientos de la disposición desde que cargó la página. */
function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        // Los registros en búfer llegan en la siguiente vuelta del bucle.
        setTimeout(() => resolve(total), 0);
      }),
  );
}

/**
 * KAM-23 · Las imágenes se sirven a su tamaño (spec `performance-budget` →
 * *Images are served optimized*).
 *
 * Escenarios: «A thumbnail is not the full-size image», «Layout does not
 * shift on image load».
 */
test.describe("imágenes optimizadas", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "la miniatura no depende del dispositivo");

  test("el catálogo pinta una miniatura WebP, no la foto original, y nada se desplaza", async ({
    page,
    request,
  }) => {
    await login(page, geeko().owner);

    // Una foto de verdad: 1000 × 800 de ruido, unos 2,4 MB.
    const original = noisePng(1000, 800);
    const name = `Taza con foto ${Date.now()}`;
    await page.goto("/catalog?kind=product");
    await page.getByRole("button", { name: "Nuevo producto" }).click();
    const form = page.getByTestId("item-form");
    await form.getByLabel("Nombre").fill(name);
    await form.getByLabel("Arrastra la foto del ítem").setInputFiles({
      name: "taza.png",
      mimeType: "image/png",
      buffer: original,
    });
    await form.getByRole("button", { name: "Crear producto" }).click();

    // ── En la lista: la miniatura, firmada, y liviana ─────────────────────
    const thumbnail = page
      .getByTestId("catalog-row")
      .filter({ hasText: name })
      .getByTestId("item-thumbnail")
      .locator("img");
    await expect(thumbnail).toHaveAttribute("src", /\.thumb\.webp\?token=/);

    const served = await request.get((await thumbnail.getAttribute("src"))!);
    expect(served.headers()["content-type"]).toBe("image/webp");
    const bytes = (await served.body()).byteLength;
    expect(bytes, `miniatura de ${bytes} bytes`).toBeLessThan(original.byteLength / 10);

    // ── En el detalle: también la miniatura, a no más de 480 px ───────────
    await page
      .getByTestId("catalog-row")
      .filter({ hasText: name })
      .getByRole("button", { name: "Acciones" })
      .click();
    await page.getByRole("menuitem", { name: "Ver" }).click();
    await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);
    const url = page.url();

    // Una carga completa, para medir desde el principio.
    await page.goto(url);
    const photo = page.getByTestId("item-photo").getByRole("img");
    await expect(photo).toHaveAttribute("src", /\.thumb\.webp\?token=/);
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeLessThanOrEqual(
      480,
    );

    // ── Y la imagen cargada no empujó nada: su hueco estaba reservado ─────
    expect(await layoutShift(page)).toBeLessThan(0.01);
  });

  // Cambio `catalog-create-form-reset`, escenario «La foto del producto
  // anterior no pasa al siguiente», de punta a punta.
  test("crear dos productos seguidos no arrastra la foto del primero", async ({ page }) => {
    await login(page, geeko().owner);

    const stamp = Date.now();
    const first = `Taza con foto ${stamp}`;
    const second = `Taza sin foto ${stamp}`;
    await page.goto("/catalog?kind=product");

    await page.getByRole("button", { name: "Nuevo producto" }).click();
    let form = page.getByTestId("item-form");
    await form.getByLabel("Nombre").fill(first);
    await form.getByLabel("Arrastra la foto del ítem").setInputFiles({
      name: "taza.png",
      mimeType: "image/png",
      buffer: noisePng(200, 160),
    });
    await form.getByRole("button", { name: "Crear producto" }).click();
    await expect(form).toBeHidden();
    await expect(
      page
        .getByTestId("catalog-row")
        .filter({ hasText: first })
        .getByTestId("item-thumbnail")
        .locator("img"),
    ).toHaveAttribute("src", /\.thumb\.webp\?token=/);

    // ── El segundo alta se abre sin la foto del primero ───────────────────
    await page.getByRole("button", { name: "Nuevo producto" }).click();
    form = page.getByTestId("item-form");
    await expect(form.getByLabel("Nombre")).toHaveValue("");
    await expect(form.getByTestId("file-preview-image")).toHaveCount(0);
    await expect(form.getByRole("button", { name: "Quitar taza.png" })).toHaveCount(0);

    await form.getByLabel("Nombre").fill(second);
    await form.getByRole("button", { name: "Crear producto" }).click();
    await expect(form).toBeHidden();

    // ── Y el segundo producto quedó sin foto ──────────────────────────────
    const row = page.getByTestId("catalog-row").filter({ hasText: second });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("item-thumbnail").locator("img")).toHaveCount(0);

    await row.getByRole("button", { name: "Acciones" }).click();
    await page.getByRole("menuitem", { name: "Ver" }).click();
    await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Sin fotografía")).toBeVisible();
    await expect(page.getByTestId("item-photo")).toHaveCount(0);
  });
});
