import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const OWNER = "owner@kamay.test"; // una sola organización
const MULTI = "multi@kamay.test"; // dos organizaciones
const RECOVERY = "recovery@kamay.test"; // solo para la prueba de recuperación

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
    await login(page, OWNER);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("top-bar")).toBeVisible();
    await expect(page.getByTestId("bottom-bar")).toBeHidden();
  });

  test("móvil aterriza en /quick con barra inferior", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "solo móvil");
    await login(page, OWNER);
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
    await login(page, MULTI);
    await expect(page).toHaveURL(/\/auth\/select-org/);
    await expect(
      page.getByRole("button", { name: "Taller Kamay" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Kamay Feria" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Kamay Feria" }).click();
    await expect(page).toHaveURL(isMobile ? /\/quick$/ : /\/dashboard$/);
    if (!isMobile) {
      await expect(page.getByTestId("top-bar")).toContainText("Kamay Feria");
    }
  });

  test("con una sola organización no hay paso de selección", async ({
    page,
    isMobile,
  }) => {
    await login(page, OWNER);
    await expect(page).toHaveURL(isMobile ? /\/quick$/ : /\/dashboard$/);
  });
});

test.describe("sesión", () => {
  test("la sesión sigue viva al navegar y recargar", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio");
    await login(page, OWNER);
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
    await login(page, OWNER);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Sesión expirada: se invalidan las cookies (D · expiración).
    await context.clearCookies();

    await page.goto("/quick");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fquick/);

    await page.getByLabel("Correo electrónico").fill(OWNER);
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

    await page.goto("/auth/forgot-password");
    await page.getByLabel("Correo electrónico").fill(RECOVERY);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(
      page.getByText(/recibirás un enlace/i),
    ).toBeVisible();

    // El correo se captura en Mailpit (servidor de correo local de Supabase).
    let confirmUrl: string | null = null;
    const deadline = Date.now() + 15_000;
    while (!confirmUrl && Date.now() < deadline) {
      const list = await request.get(
        `${MAILPIT}/api/v1/search?query=to:${RECOVERY}`,
      );
      const { messages } = await list.json();
      if (messages?.length) {
        const detail = await request.get(
          `${MAILPIT}/api/v1/message/${messages[0].ID}`,
        );
        const { HTML } = await detail.json();
        const match = HTML?.match(
          /http:\/\/localhost:3010\/auth\/confirm[^"']+/,
        );
        if (match) confirmUrl = match[0].replace(/&amp;/g, "&");
      }
      if (!confirmUrl) await page.waitForTimeout(500);
    }
    expect(confirmUrl, "no llegó el correo de recuperación").not.toBeNull();

    await page.goto(confirmUrl!);
    await expect(page).toHaveURL(/\/auth\/reset-password/);

    // Supabase rechaza reutilizar la contraseña anterior: una nueva por corrida.
    const newPassword = `kamay-${Date.now()}`;
    await page.getByLabel("Nueva contraseña").fill(newPassword);
    await page.getByLabel("Repite la contraseña").fill(newPassword);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    // Con sesión activa tras el cambio, aterriza dentro de la aplicación.
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
