import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

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

test.describe("configuración de estados (V22)", () => {
  test.skip(({ isMobile }) => isMobile, "V22 es una pantalla de escritorio");

  test("personalizar el juego de tareas de Alfarería no toca a las otras líneas", async ({
    page,
  }) => {
    // Misma razón que en `archive-restore`: la espera reintenta hasta 30 s y
    // el límite por omisión es ese mismo, así que no le cabría ni una vuelta.
    test.setTimeout(90_000);

    await login(page, geeko().owner);

    // Alfarería, flujo Tareas: sin juego propio, rige el de la organización.
    await page.goto("/settings/statuses?flow=task&line=org");
    const alfareriaId = await page
      .getByTestId("status-scope")
      .locator("option", { hasText: "Alfarería" })
      .getAttribute("value");
    await page.goto(`/settings/statuses?flow=task&line=${alfareriaId}`);

    // Una corrida anterior pudo dejar el juego propio creado: se vuelve al de
    // la organización para partir siempre del mismo punto, confirmándolo en
    // su diálogo («Volver al juego de la organización»).
    if (
      await page
        .getByRole("button", { name: "Usar el juego de la organización" })
        .isVisible()
    ) {
      await page
        .getByRole("button", { name: "Usar el juego de la organización" })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Usar el juego de la organización" })
        .click();
    }

    await expect(
      page.getByText("usa el juego de estados de la organización"),
    ).toBeVisible();

    // Crear el juego propio, confirmándolo: nace copiado del juego de la
    // organización.
    await page
      .getByRole("button", { name: "Crear juego propio para esta línea" })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Crear juego propio" })
      .click();
    const list = page.getByTestId("status-list");
    await expect(list.getByText("Por hacer")).toBeVisible();

    // Editar en un diálogo, desde el «⋯» de la fila: renombrar un estado del
    // juego propio («Editar un estado en un diálogo»).
    const renamed = uniqueName("Amasando");
    const row = page
      .getByTestId("status-row")
      .filter({ hasText: "Haciendo" })
      .first();
    await row.getByRole("button", { name: /^Acciones de / }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre").fill(renamed);
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog).toBeHidden();
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

    const primeroDeAntes = firstBefore.split("\n")[0];

    // La tarjeta se pinta en su sitio nuevo antes de que el servidor conteste.
    await expect(page.getByTestId("status-row").first()).not.toContainText(
      primeroDeAntes,
    );

    // Y el orden sobrevive a recargar. Se reintenta la recarga porque la
    // escritura sigue viva cuando se suelta el ratón: recargar de inmediato la
    // cancelaba a mitad y el orden volvía al de antes. Si no llegara a
    // guardarse nunca, esto sigue fallando.
    await expect(async () => {
      await page.reload();
      await expect(page.getByTestId("status-row").first()).not.toContainText(
        primeroDeAntes,
      );
    }).toPass({ timeout: 30_000 });

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

  test("archivar el único estado inicial se bloquea en su confirmación", async ({
    page,
  }) => {
    await login(page, geeko().owner);

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
    await initialRow.getByRole("button", { name: /^Acciones de / }).click();
    await page.getByRole("menuitem", { name: "Archivar" }).click();

    // La confirmación lo dice y no deja archivar.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("alert")).toHaveText(
      /al menos un estado inicial y uno final/,
    );
    await expect(
      dialog.getByRole("button", { name: "Archivar estado" }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();

    // Y el estado sigue en su lista, intacto.
    await expect(
      page.getByTestId("status-list").getByText("Reservado"),
    ).toBeVisible();
  });

  test("el ayudante es redirigido al entrar por dirección directa", async ({
    page,
  }) => {
    await login(page, geeko().assistant);

    await page.goto("/settings/statuses");
    await page.waitForURL((url) => !url.pathname.startsWith("/settings"));
    expect(new URL(page.url()).pathname.startsWith("/settings")).toBe(false);
  });
});
