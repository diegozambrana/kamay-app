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

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

test.describe("configuración de estados (V22)", () => {
  test.skip(({ isMobile }) => isMobile, "V22 es una pantalla de escritorio");

  test("personalizar el juego de tareas de Alfarería no toca a las otras líneas", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    // Alfarería, flujo Tareas: sin juego propio, rige el de la organización.
    await page.goto("/settings/statuses?flow=task&line=org");
    const alfareriaId = await page
      .getByTestId("status-scope")
      .locator("option", { hasText: "Alfarería" })
      .getAttribute("value");
    await page.goto(`/settings/statuses?flow=task&line=${alfareriaId}`);

    // Una corrida anterior pudo dejar el juego propio creado: se vuelve al de
    // la organización para partir siempre del mismo punto.
    if (
      await page
        .getByRole("button", { name: "Usar el juego de la organización" })
        .isVisible()
    ) {
      await page
        .getByRole("button", { name: "Usar el juego de la organización" })
        .click();
      await page.getByRole("button", { name: "Confirmar" }).click();
    }

    await expect(
      page.getByText("usa el juego de estados de la organización"),
    ).toBeVisible();

    // Crear el juego propio: nace copiado del juego de la organización.
    await page
      .getByRole("button", { name: "Crear juego propio para esta línea" })
      .click();
    const list = page.getByTestId("status-list");
    await expect(list.getByText("Por hacer")).toBeVisible();

    // Editar en el sitio: renombrar un estado del juego propio.
    const renamed = uniqueName("Amasando");
    const row = page
      .getByTestId("status-row")
      .filter({ hasText: "Haciendo" })
      .first();
    await row.getByRole("button", { name: "Editar" }).click();
    await row.getByLabel("Nombre").fill(renamed);
    await row.getByRole("button", { name: "Guardar" }).click();
    await expect(list.getByText(renamed)).toBeVisible();

    // Reordenar por arrastre: el primero baja un lugar y el orden persiste.
    const firstBefore = await page
      .getByTestId("status-row")
      .first()
      .innerText();
    const handle = page
      .getByTestId("status-row")
      .first()
      .getByRole("button", { name: /Reordenar/ });
    const target = page.getByTestId("status-row").nth(1);
    const handleBox = (await handle.boundingBox())!;
    const targetBox = (await target.boundingBox())!;
    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2 + 10,
      { steps: 12 },
    );
    await page.mouse.up();

    await expect(page.getByTestId("status-row").first()).not.toContainText(
      firstBefore.split("\n")[0],
    );
    await page.reload();
    await expect(page.getByTestId("status-row").first()).not.toContainText(
      firstBefore.split("\n")[0],
    );

    // Las demás líneas no se enteraron: Sublimación sigue sin juego propio…
    const sublimacionId = await page
      .getByTestId("status-scope")
      .locator("option", { hasText: "Sublimación" })
      .getAttribute("value");
    await page.goto(`/settings/statuses?flow=task&line=${sublimacionId}`);
    await expect(
      page.getByText("usa el juego de estados de la organización"),
    ).toBeVisible();

    // …el juego de tareas de la organización quedó intacto…
    await page.goto("/settings/statuses?flow=task&line=org");
    await expect(
      page.getByTestId("status-list").getByText("Por hacer"),
    ).toBeVisible();
    await expect(
      page.getByTestId("status-list").getByText(renamed),
    ).toHaveCount(0);

    // …y el juego de pedidos de Sublimación conserva su columna en cola.
    await page.goto(`/settings/statuses?flow=order&line=${sublimacionId}`);
    await expect(
      page.getByTestId("status-list").getByText("Sublimando"),
    ).toBeVisible();
    await expect(page.getByText("Columna en cola").first()).toBeVisible();
  });

  test("archivar exige decir a dónde mover y valida el juego restante", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    // El juego de pedidos de Alfarería tiene un solo estado inicial:
    // archivarlo dejaría el juego inválido y la pantalla lo dice antes de enviar.
    const scopePage = "/settings/statuses?flow=order&line=org";
    await page.goto(scopePage);
    const alfareriaId = await page
      .getByTestId("status-scope")
      .locator("option", { hasText: "Alfarería" })
      .getAttribute("value");
    await page.goto(`/settings/statuses?flow=order&line=${alfareriaId}`);

    const initialRow = page
      .getByTestId("status-row")
      .filter({ hasText: "Reservado" })
      .first();
    await initialRow.getByRole("button", { name: "Archivar" }).click();
    await expect(
      initialRow.getByLabel("Mover los registros que lo usaban a"),
    ).toBeVisible();
    await initialRow.getByRole("button", { name: "Archivar estado" }).click();

    await expect(initialRow.getByRole("alert")).toHaveText(
      /al menos un estado inicial y uno final/,
    );
    // Y el estado sigue en su lista, intacto.
    await expect(
      page.getByTestId("status-list").getByText("Reservado"),
    ).toBeVisible();
  });

  test("el ayudante es redirigido al entrar por dirección directa", async ({
    page,
  }) => {
    await login(page, GEEKO_ASSISTANT);

    await page.goto("/settings/statuses");
    await page.waitForURL((url) => !url.pathname.startsWith("/settings"));
    expect(new URL(page.url()).pathname.startsWith("/settings")).toBe(false);
  });
});
