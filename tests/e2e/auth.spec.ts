import { addOrganizationFor, createFreshOrganization, E2E_PASSWORD } from "./helpers/fresh-org";
import { expect, test, type Page } from "./helpers/test";

// Cada prueba entra con una dueña propia (KAM-23): la de recuperación cambia
// la contraseña, y ninguna otra puede depender de lo que esa deje.
const PASSWORD = E2E_PASSWORD;

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54424";

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("acceso sin sesión", () => {
  test("visitante anónimo es redirigido a /auth/login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fdashboard/);
  });

  test("la pantalla de entrada no ofrece registro público", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByText(/regístrate|registrarse|crear cuenta/i)).toHaveCount(0);
  });
});

test.describe("aterrizaje por dispositivo y cascarón", () => {
  test("escritorio aterriza en /dashboard con barra superior", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio");
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("top-bar")).toBeVisible();
    await expect(page.getByTestId("bottom-bar")).toBeHidden();
  });

  test("móvil aterriza en /quick con barra inferior", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "solo móvil");
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await expect(page).toHaveURL(/\/quick$/);
    await expect(page.getByTestId("bottom-bar")).toBeVisible();
    await expect(page.getByTestId("top-bar")).toBeHidden();
  });
});

test.describe("selección de organización", () => {
  test("con dos organizaciones se elige antes de continuar", async ({
    page,
    isMobile,
  }) => {
    const owner = await createFreshOrganization();
    const feria = `Feria ${owner.organizationName}`;
    await addOrganizationFor(owner, feria);

    await login(page, owner.email);
    await expect(page).toHaveURL(/\/auth\/select-org/);
    await expect(
      page.getByRole("button", { name: owner.organizationName, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: feria, exact: true })).toBeVisible();

    await page.getByRole("button", { name: feria, exact: true }).click();
    await expect(page).toHaveURL(isMobile ? /\/quick$/ : /\/dashboard$/);
    if (!isMobile) {
      await expect(page.getByTestId("top-bar")).toContainText(feria);
    }
  });

  test("con una sola organización no hay paso de selección", async ({
    page,
    isMobile,
  }) => {
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await expect(page).toHaveURL(isMobile ? /\/quick$/ : /\/dashboard$/);
  });
});

test.describe("sesión", () => {
  test("la sesión sigue viva al navegar y recargar", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio");
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/quick");
    await expect(page).toHaveURL(/\/quick$/);
    await page.reload();
    await expect(page).toHaveURL(/\/quick$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("top-bar")).toBeVisible();
  });

  test("al expirar la sesión se vuelve a la ruta original tras entrar", async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio");
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Sesión expirada: se invalidan las cookies (D · expiración).
    await context.clearCookies();

    await page.goto("/quick");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fquick/);

    await page.getByLabel("Correo electrónico").fill(owner.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    // Regresa a la ruta que intentaba abrir, no al aterrizaje por defecto.
    await expect(page).toHaveURL(/\/quick$/);
  });
});

test.describe("recuperación de contraseña", () => {
  test("el usuario recupera el acceso con el enlace del correo", async ({
    page,
    request,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio");

    // Una usuaria propia: el correo que se busca en Mailpit es solo suyo, y
    // la contraseña que se cambia no la usa nadie más.
    const { email: recovery } = await createFreshOrganization();

    await page.goto("/auth/forgot-password");
    await page.getByLabel("Correo electrónico").fill(recovery);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(
      page.getByText(/recibirás un enlace/i),
    ).toBeVisible();

    // El correo se captura en Mailpit (servidor de correo local de Supabase).
    // La espera se ancla a que el correo llegue, no a un tiempo fijo:
    // `expect.poll` vuelve a preguntar hasta que haya enlace o venza el plazo.
    let confirmUrl: string | null = null;
    await expect
      .poll(
        async () => {
          const list = await request.get(
            `${MAILPIT}/api/v1/search?query=to:${recovery}`,
          );
          const { messages } = await list.json();
          if (!messages?.length) return null;
          const detail = await request.get(
            `${MAILPIT}/api/v1/message/${messages[0].ID}`,
          );
          const { HTML } = await detail.json();
          const match = HTML?.match(
            /http:\/\/localhost:3010\/auth\/confirm[^"']+/,
          );
          confirmUrl = match ? match[0].replace(/&amp;/g, "&") : null;
          return confirmUrl;
        },
        { message: "no llegó el correo de recuperación", timeout: 15_000 },
      )
      .not.toBeNull();

    await page.goto(confirmUrl!);
    await expect(page).toHaveURL(/\/auth\/reset-password/);

    // Supabase rechaza reutilizar la contraseña anterior.
    const newPassword = `kamay-${Date.now()}`;
    await page.getByLabel("Nueva contraseña").fill(newPassword);
    await page.getByLabel("Repite la contraseña").fill(newPassword);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    // Con sesión activa tras el cambio, aterriza dentro de la aplicación.
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
