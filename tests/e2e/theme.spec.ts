import { createFreshOrganization, E2E_PASSWORD } from "./helpers/fresh-org";
import { expect, test } from "./helpers/test";

/**
 * `project-foundation` · «Theme toggle in the top bar switches and persists».
 *
 * Hasta KAM-25 esto se probaba en la página vacía de la raíz; la raíz ahora
 * solo redirige, y el selector vive donde se usa: la barra superior del
 * cascarón. En móvil esa barra no se muestra y no hay selector de tema.
 */
test("el tema alterna desde la barra superior y persiste", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "solo escritorio");
  const owner = await createFreshOrganization();

  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(owner.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const toggle = page
    .getByTestId("top-bar")
    .getByRole("button", { name: "Cambiar tema" });
  await expect(toggle).toBeVisible();

  // Fija un punto de partida conocido leyendo el tema resuelto actual.
  const initialIsDark = await page
    .locator("html")
    .evaluate((el) => el.classList.contains("dark"));

  await toggle.click();
  await expect
    .poll(() =>
      page.locator("html").evaluate((el) => el.classList.contains("dark")),
    )
    .toBe(!initialIsDark);

  await page.reload();
  await expect(toggle).toBeVisible();
  await expect
    .poll(() =>
      page.locator("html").evaluate((el) => el.classList.contains("dark")),
    )
    .toBe(!initialIsDark);
});
