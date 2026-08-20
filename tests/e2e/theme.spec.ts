import { expect, test } from "@playwright/test";

test("la página vacía carga y el tema alterna y persiste", async ({ page }) => {
  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Cambiar tema" });
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
