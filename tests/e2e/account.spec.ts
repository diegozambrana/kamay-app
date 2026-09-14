import {
  createAccountWithoutOrganization,
  createFreshOrganization,
  E2E_PASSWORD,
} from "./helpers/fresh-org";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

/**
 * KAM-24 · Menú de cuenta y perfil.
 *
 * Escenarios de los deltas `user-auth` («Cerrar sesión desde el menú de
 * cuenta», «Cerrar sesión con registros pendientes de sincronizar») y
 * `account-profile` («Abrir el perfil desde el menú de cuenta», «Cambiar el
 * nombre visible», «Cambiar la contraseña con la contraseña actual
 * correcta», «La contraseña actual incorrecta no cambia nada»).
 */

async function login(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Se espera a que la redirección tras entrar termine antes de seguir: un
  // `goto` disparado a mitad de camino corta esa navegación y deja a la
  // persona en /auth/login, no en la ruta que la prueba pide después.
  await page.waitForURL(/^(?!.*\/auth\/login).*$/);
}

/** Abre el menú/panel de cuenta según la superficie y elige "Perfil". */
async function goToProfile(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByTestId("bottom-bar-more").click();
    await page
      .getByTestId("account-block")
      .getByRole("link", { name: "Perfil" })
      .click();
  } else {
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("account-menu-profile").click();
  }
}

/** Igual, pero para "Cerrar sesión". */
async function requestSignOutFromShell(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByTestId("bottom-bar-more").click();
    await page.getByTestId("mobile-sign-out").click();
  } else {
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("account-menu-sign-out").click();
  }
}

test.describe("menú de cuenta", () => {
  test("desde el avatar/panel «Más» se llega a /profile", async ({
    page,
    isMobile,
  }) => {
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await expect(page).toHaveURL(isMobile ? /\/quick$/ : /\/dashboard$/);

    await goToProfile(page, isMobile);

    await expect(page).toHaveURL(/\/profile$/);
    // Datos de solo lectura: correo, organización activa y rol (escenario
    // "Profile shows read-only account data").
    await expect(page.getByTestId("profile-email")).toHaveText(owner.email);
    await expect(page.getByTestId("profile-organization")).toHaveText(
      owner.organizationName,
    );
    await expect(page.getByTestId("profile-role")).toHaveText("Dueño");
  });

  test("cerrar sesión sin pendientes termina la sesión de inmediato", async ({
    page,
    isMobile,
  }) => {
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await expect(page).toHaveURL(isMobile ? /\/quick$/ : /\/dashboard$/);

    await requestSignOutFromShell(page, isMobile);

    await expect(page).toHaveURL(/\/auth\/login/);
    // Y la ruta protegida vuelve a pedir credenciales, no queda una sesión viva.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
    // Tampoco por la raíz (KAM-25 · «A session that ended no longer reaches
    // the app through the root»): `/` ya no encuentra sesión y va a la entrada.
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});

/**
 * KAM-25 · `user-auth` — requisito "An account without an organization can
 * sign out": «The notice offers a way out», «Signing out from the notice goes
 * to login» y «After signing out, the notice is no longer reachable».
 */
test.describe("cuenta sin organización", () => {
  test("el aviso ofrece cerrar sesión y la salida es real", async ({ page }) => {
    const account = await createAccountWithoutOrganization();
    await login(page, account.email);

    const signOutButton = page.getByTestId("no-organization-sign-out");
    await expect(page.getByText(/no pertenece a ninguna organización/)).toBeVisible();
    await expect(signOutButton).toBeVisible();
    await expect(page.getByTestId("top-bar")).toHaveCount(0);
    await expect(page.getByTestId("bottom-bar")).toHaveCount(0);

    await signOutButton.click();
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });
});

test.describe("perfil: nombre visible", () => {
  test("cambiar el nombre visible se refleja en el equipo", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "el listado de equipo (dueño) es solo de escritorio");
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await page.goto("/profile");

    const nuevoNombre = `Marcela ${Date.now()}`;
    await page.getByLabel("Nombre visible").fill(nuevoNombre);
    await page.getByRole("button", { name: "Guardar nombre" }).click();
    await expect(page.getByTestId("profile-saved")).toBeVisible();

    await page.goto("/settings/members");
    await expect(page.getByText(nuevoNombre)).toBeVisible();
  });

  test("un nombre vacío no se guarda", async ({ page, isMobile }) => {
    test.skip(isMobile, "basta probarlo una vez");
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await page.goto("/profile");

    await page.getByLabel("Nombre visible").fill("");
    await page.getByRole("button", { name: "Guardar nombre" }).click();

    await expect(page.getByText("Ingresa un nombre.")).toBeVisible();
    await expect(page.getByTestId("profile-saved")).toHaveCount(0);
  });
});

test.describe("perfil: contraseña", () => {
  test("cambiarla con la actual correcta permite volver a entrar con la nueva", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio: basta probarlo una vez");
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await page.goto("/profile");

    const nueva = `kamay-${Date.now()}`;
    await page.getByTestId("open-change-password").click();
    await page.getByLabel("Contraseña actual").fill(E2E_PASSWORD);
    await page.getByLabel("Nueva contraseña", { exact: true }).fill(nueva);
    await page.getByLabel("Confirmar nueva contraseña").fill(nueva);
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();

    await expect(page.getByTestId("change-password-dialog")).toHaveCount(0);

    await requestSignOutFromShell(page, isMobile);
    await expect(page).toHaveURL(/\/auth\/login/);

    await login(page, owner.email, nueva);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("con la actual incorrecta muestra el error sin perder la sesión", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "solo escritorio");
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await page.goto("/profile");

    await page.getByTestId("open-change-password").click();
    await page.getByLabel("Contraseña actual").fill("no-es-esta");
    await page.getByLabel("Nueva contraseña", { exact: true }).fill("otra-nueva-123");
    await page.getByLabel("Confirmar nueva contraseña").fill("otra-nueva-123");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();

    await expect(
      page.getByText("La contraseña actual no es correcta."),
    ).toBeVisible();
    // Sin cerrar el modal.
    await expect(page.getByTestId("change-password-dialog")).toBeVisible();

    // Y sin perder la sesión: recargar sigue dentro, no a /auth/login.
    await page.reload();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("nueva y confirmación distintas no llegan al servidor", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "basta probarlo una vez");
    const owner = await createFreshOrganization();
    await login(page, owner.email);
    await page.goto("/profile");

    await page.getByTestId("open-change-password").click();
    await page.getByLabel("Contraseña actual").fill(E2E_PASSWORD);
    await page.getByLabel("Nueva contraseña", { exact: true }).fill("nueva-contra-1");
    await page.getByLabel("Confirmar nueva contraseña").fill("nueva-contra-2");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();

    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
    await expect(page.getByTestId("change-password-dialog")).toBeVisible();
  });
});

/**
 * Un insumo propio y su detalle, con red: es el punto de partida para
 * registrar un consumo sin ella. No se usa un pedido —a diferencia de
 * `offline-capture.spec.ts`— porque tras guardarlo el formulario navega al
 * detalle recién creado, y esa navegación (RSC, por red) no resuelve sin
 * conexión: la persona se quedaría en `/orders/new`, que en móvil no rinde
 * la barra inferior (es ruta de captura). El consumo, en cambio, no navega:
 * el diálogo se cierra sobre la misma pantalla.
 */
async function abrirDetalleDeInsumoPropio(page: Page): Promise<void> {
  const nombre = `Insumo pendiente ${Date.now()}`;
  await page.goto("/catalog?kind=supply");
  await page.getByRole("button", { name: "Nuevo ítem" }).click();
  const form = page.getByTestId("item-form");
  await form.getByLabel("Nombre").fill(nombre);
  await form.getByRole("button", { name: "Crear ítem" }).click();

  const fila = page.getByTestId("catalog-row").filter({ hasText: nombre });
  await expect(fila).toHaveCount(1);
  await fila.getByRole("button", { name: "Acciones" }).click();
  await page.getByRole("menuitem", { name: "Ver" }).click();
  await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);
  // El detalle llega por streaming (Suspense): sin esperar a que el botón
  // aparezca, `setOffline` puede cortar la conexión a mitad del envío y la
  // sección de inventario se queda cargando para siempre.
  await expect(
    page.getByRole("button", { name: "Registrar consumo" }),
  ).toBeVisible();
}

/** El consumo mismo, ya sin red: se encola y el diálogo se cierra. */
async function registrarConsumoSinRed(page: Page) {
  await page.getByRole("button", { name: "Registrar consumo" }).click();
  await page.getByLabel("Cantidad").fill("1");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByTestId("consumption-form")).toHaveCount(0);
}

test.describe("cerrar sesión con registros pendientes", () => {
  // Escenario "Cerrar sesión con registros pendientes de sincronizar": pide
  // confirmación antes de proceder, en ambas superficies.
  test("con un registro sin sincronizar, cerrar sesión pide confirmación", async ({
    page,
    context,
    isMobile,
  }) => {
    test.setTimeout(60_000);
    await login(page, geeko().owner);
    await abrirDetalleDeInsumoPropio(page);

    await context.setOffline(true);
    await registrarConsumoSinRed(page);

    await requestSignOutFromShell(page, isMobile);

    await expect(
      page.getByText("¿Cerrar sesión con registros pendientes?"),
    ).toBeVisible();
    await expect(page.getByText(/1 registro por sincronizar/)).toBeVisible();
    // No procede sola: sigue en la misma pantalla, con sesión.
    await expect(page).not.toHaveURL(/\/auth\/login/);

    // Confirmar sí cierra la sesión (con red: el cierre es una acción de
    // servidor).
    await context.setOffline(false);
    await page.getByTestId("confirm-sign-out").click();

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("volver deja la sesión intacta y el registro sigue pendiente", async ({
    page,
    context,
    isMobile,
  }) => {
    test.skip(isMobile, "basta probarlo una vez");
    test.setTimeout(60_000);
    await login(page, geeko().owner);
    await abrirDetalleDeInsumoPropio(page);

    await context.setOffline(true);
    await registrarConsumoSinRed(page);

    await requestSignOutFromShell(page, isMobile);
    await page.getByRole("button", { name: "Volver" }).click();

    await expect(page).not.toHaveURL(/\/auth\/login/);
    await context.setOffline(false);
  });
});
