import { createFreshOrganization, E2E_PASSWORD } from "./helpers/fresh-org";
import { expect, test, type Page } from "./helpers/test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * KAM-23 · El alta de cuentas la abre una invitación y nada más, de punta a
 * punta: con el hook `before_user_created` activo (spec
 * `production-operations` → *Only a pending invitation can create an
 * account*).
 *
 * Escenarios: «A pending invitation lets the invitee sign up», «Signing up
 * without an invitation is rejected». «Existing users are unaffected» lo
 * cubren `auth.spec.ts` y el `login` de cada recorrido.
 */
test.describe("alta por invitación", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "el alta no depende del dispositivo");

  test("la persona invitada crea su cuenta desde el enlace y entra a la organización", async ({
    page,
    browser,
  }) => {
    const organization = await createFreshOrganization();
    const invitee = `invitada-${Date.now()}-${Math.floor(Math.random() * 1e5)}@kamay.test`;

    await login(page, organization.email);
    await page.goto("/settings/members");
    // Invitar en un diálogo, que al crearla muestra el enlace una sola vez
    // («Owner invites and copies the link from the dialog»).
    await page.getByRole("button", { name: "Invitar" }).click();
    const dialog = page.getByRole("dialog", { name: "Invitar" });
    await dialog.getByLabel("Correo").fill(invitee);
    await dialog.getByRole("button", { name: "Invitar" }).click();
    const created = page.getByRole("dialog", { name: "Invitación creada" });
    await expect(created.getByRole("button", { name: "Copiar enlace" })).toBeVisible();
    const link = (await created.getByTestId("invite-url").locator("code").textContent())?.trim();
    expect(link).toMatch(/\/auth\/invite\/[^/]+$/);

    // Otra persona, en su propio navegador y sin sesión.
    const context = await browser.newContext();
    const guest = await context.newPage();
    await guest.goto(link!);
    await guest.getByLabel("Correo").fill(invitee);
    await guest.getByLabel("Contraseña").fill("kamay12345");
    await guest.getByRole("button", { name: "Crear cuenta y unirme" }).click();

    // Entra ya como miembro: el encabezado muestra la organización que la
    // invitó.
    await guest.waitForURL(/\/(dashboard|quick)$/);
    await expect(guest.getByText(organization.organizationName).first()).toBeVisible();
    await context.close();
  });

  test("sin invitación vigente no se crea ninguna cuenta", async ({ page }) => {
    // Un enlace inventado: el correo no tiene ninguna invitación.
    await page.goto("/auth/invite/enlace-inventado");
    await page
      .getByLabel("Correo")
      .fill(`intrusa-${Date.now()}-${Math.floor(Math.random() * 1e5)}@kamay.test`);
    await page.getByLabel("Contraseña").fill("kamay12345");
    await page.getByRole("button", { name: "Crear cuenta y unirme" }).click();

    await expect(page.getByText("No se pudo crear la cuenta con ese correo.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/invite\//);
  });
});
