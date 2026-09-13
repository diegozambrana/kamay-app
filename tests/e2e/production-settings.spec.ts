import { readFileSync } from "node:fs";

import { expect, test } from "./helpers/test";

/**
 * KAM-23 · Lo que la compilación de producción promete a quien llega de fuera
 * (spec `production-operations` → *The application is deployed on its own
 * domain with production settings*).
 *
 * Escenarios: «The application is not indexable» y la primera mitad de «A new
 * deployment reaches returning users» —cada compilación sirve otro service
 * worker, y el navegador nunca lo guarda—. La otra mitad, que la versión nueva
 * toma el control de una pestaña abierta, está en `deployment.spec.ts`.
 * «The production domain serves the application over HTTPS» se comprueba
 * sobre el dominio propio (tarea 10.5).
 */
test.describe("ajustes de producción", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "no dependen del dispositivo");

  test("ninguna página se deja indexar", async ({ page, request }) => {
    for (const path of ["/auth/login", "/dashboard"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    }
    // Y ninguna cabecera que solo sirve para saber con qué está hecha.
    const login = await request.get("/auth/login");
    expect(login.headers()["x-powered-by"]).toBeUndefined();

    await page.goto("/auth/login");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });

  test("cada compilación sirve su propio service worker, y el navegador nunca lo guarda", async ({
    request,
  }) => {
    test.skip(!process.env.CI, "necesita la compilación de producción");

    const script = await request.get("/sw.js");
    expect(script.headers()["cache-control"]).toContain("no-store");
    // El manifiesto de precarga lleva la huella de la compilación: dos
    // despliegues nunca sirven los mismos bytes, y el navegador solo
    // reemplaza un service worker cuyos bytes cambiaron.
    expect(await script.text()).toContain(readFileSync(".next/BUILD_ID", "utf8").trim());
  });
});
