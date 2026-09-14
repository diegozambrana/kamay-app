import {
  addOwnedOrganization,
  createAccountWithoutOrganization,
  createFreshOrganization,
  createPlatformAdmin,
  E2E_PASSWORD,
  revokePlatformAdmin,
  SEED_PLATFORM_ADMIN,
  signedInClient,
} from "./helpers/fresh-org";
import { geeko } from "./helpers/seed-copies";
import { expect, test, type Page } from "./helpers/test";

/**
 * KAM-26 · El administrador de la plataforma (spec `platform-administration`
 * y los deltas de `user-auth`).
 *
 * El super admin de la semilla se comparte entre pruebas —cada una en su
 * propio navegador, con su propia cookie de organización—; lo que lo
 * cambiaría para las demás (revocarlo, darle membresías) usa una cuenta
 * propia de `createPlatformAdmin()`. La base local acumula organizaciones de
 * toda la suite, así que nada se busca contando filas: se busca por nombre.
 */

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/^(?!.*\/auth\/login).*$/);
}

function suffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

/**
 * Una organización creada por el super admin de la semilla, sin equipo. Su
 * nombre empieza con «0 » para caer entre las primeras por orden alfabético:
 * el selector y la lista de asignación traen un tope de organizaciones, y la
 * base de pruebas tiene cientos.
 */
async function platformOrganization(label: string): Promise<{ id: string; name: string }> {
  const name = `0 KAM-26 ${label} ${suffix()}`;
  const session = await signedInClient(SEED_PLATFORM_ADMIN);
  const { data, error } = await session.rpc("create_organization", { p_name: name });
  if (error) throw new Error(`organización: ${error.message}`);
  return { id: data as string, name };
}

/** Entra a una organización desde la vista Organizaciones, buscándola. */
async function enterFromList(page: Page, name: string) {
  await page.goto(`/admin/organizations?q=${encodeURIComponent(name)}`);
  await page.getByRole("button", { name: `Entrar a ${name}` }).click();
}

/**
 * Las filas que se ven: `DataTable` rinde tabla y tarjetas, y el CSS decide
 * cuál aparece según el ancho. Contar ambas contaría cada registro dos veces.
 */
function visibleRows(page: Page, testId: string) {
  return page.getByTestId(testId).filter({ visible: true });
}

async function desbordaHorizontalmente(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

test.describe("entrada del super admin", () => {
  test("sin organización aterriza en Organizaciones y nunca ve el aviso", async ({ page }) => {
    // «A platform admin without memberships never sees the notice», «A
    // platform admin without an organization lands on Organizations».
    await login(page, SEED_PLATFORM_ADMIN);

    await expect(page).toHaveURL(/\/admin\/organizations$/);
    await expect(page.getByRole("heading", { name: "Organizaciones" })).toBeVisible();
    await expect(page.getByText(/no pertenece a ninguna organización/)).toHaveCount(0);

    await page.goto("/");
    await expect(page).toHaveURL(/\/admin\/organizations$/);
  });

  test("con dos membresías tampoco pasa por la selección", async ({ page }) => {
    // «A platform admin never gets the selection screen».
    const admin = await createPlatformAdmin();
    await addOwnedOrganization(admin, `Taller propio A ${suffix()}`);
    await addOwnedOrganization(admin, `Taller propio B ${suffix()}`);

    await login(page, admin.email);
    await expect(page).toHaveURL(/\/admin\/organizations$/);

    await page.goto("/auth/select-org");
    await expect(page).toHaveURL(/\/admin\/organizations$/);
  });

  test("con su organización aún válida vuelve a su inicio al entrar", async ({
    page,
    context,
    isMobile,
  }) => {
    // «A platform admin back in an organization lands on the home»: la sesión
    // caduca, la cookie de organización sigue.
    const organization = await platformOrganization("Regreso");
    await login(page, SEED_PLATFORM_ADMIN);
    await enterFromList(page, organization.name);
    await expect(page).toHaveURL(isMobile ? /\/quick$/ : /\/dashboard$/);

    await context.clearCookies({ name: /^sb-/ });
    await login(page, SEED_PLATFORM_ADMIN);
    await expect(page).toHaveURL(isMobile ? /\/quick$/ : /\/dashboard$/);
  });
});

test.describe("cascarón sin organización", () => {
  test.skip(({ isMobile }) => isMobile, "el menú lateral es de escritorio");

  test("las rutas de una organización mandan a Organizaciones", async ({ page }) => {
    // «Organization-scoped routes need an organization».
    await login(page, SEED_PLATFORM_ADMIN);
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/admin\/organizations$/);
  });

  test("el cascarón reducido no monta lo que necesita una organización", async ({ page }) => {
    // «The platform shell omits organization controls».
    await login(page, SEED_PLATFORM_ADMIN);
    await page.goto("/admin/users");

    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link")).toHaveText(["Organizaciones", "Usuarios"]);
    await expect(page.getByTestId("organization-switcher")).toContainText("Vista de plataforma");
    await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
    await expect(page.getByTestId("line-selector")).toHaveCount(0);
    await expect(page.getByTestId("notification-bell")).toHaveCount(0);
    await expect(page.getByTestId("register-button")).toHaveCount(0);
  });
});

test.describe("vista Organizaciones", () => {
  test("lista, busca y entra a una organización como su dueña", async ({ page, isMobile }) => {
    // «Every organization is listed», «Searching by name», «Entering an
    // organization».
    const fresh = await createFreshOrganization();
    await login(page, SEED_PLATFORM_ADMIN);

    await page.getByLabel("Buscar organización por nombre").fill(fresh.organizationName);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/\?q=/);
    const row = visibleRows(page, "organization-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(fresh.organizationName);

    await page.getByRole("button", { name: `Entrar a ${fresh.organizationName}` }).click();
    await expect(page).toHaveURL(isMobile ? /\/quick$/ : /\/dashboard$/);
    if (!isMobile) {
      await expect(page.getByTestId("top-bar")).toContainText(fresh.organizationName);
      const nav = page.getByRole("navigation", { name: "Navegación principal" });
      await expect(nav.getByRole("link", { name: "Configuración" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Egresos" })).toBeVisible();
    }
  });

  test("crea una organización, edita sus datos y arma su equipo", async ({ page }) => {
    // «The new organization is usable» (en la interfaz), «Editing the
    // organization's data», «Adding an existing account as owner», «Members
    // are listed with their email», «Inviting an email».
    const account = await createAccountWithoutOrganization();
    const name = `Taller Norte ${suffix()}`;
    await login(page, SEED_PLATFORM_ADMIN);

    await page.getByRole("button", { name: "Nueva organización" }).click();
    await page.getByLabel("Nombre", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Crear" }).click();
    await expect(page).toHaveURL(/\/admin\/organizations\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();

    const renamed = `${name} editado`;
    await page.getByLabel("Nombre", { exact: true }).fill(renamed);
    await page.getByLabel("Zona horaria").fill("America/Lima");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("status")).toHaveText("Cambios guardados.");
    await page.reload();
    await expect(page.getByRole("heading", { name: renamed })).toBeVisible();
    await expect(page.getByLabel("Zona horaria")).toHaveValue("America/Lima");

    // «Agregar usuario» desde el detalle: la organización viene dada.
    await page.getByRole("button", { name: "Agregar usuario" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(renamed)).toBeVisible();
    await dialog.getByLabel("Correo").fill(account.email);
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(dialog.getByTestId("add-user-result")).toContainText("ya es parte de");

    // Un correo sin cuenta queda invitado, con su enlace.
    await dialog.getByLabel("Correo").fill(`invitada-${suffix()}@kamay.test`);
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(dialog.getByTestId("invite-url")).toContainText("/auth/invite/");
    await page.keyboard.press("Escape");

    const member = visibleRows(page, "platform-member");
    await expect(member).toContainText(account.email);
  });
});

test.describe("vista Usuarios", () => {
  test.skip(({ isMobile }) => isMobile, "la asignación se prueba en escritorio");

  test("lista cuentas, filtra las sin organización y asigna dos de una vez", async ({
    page,
    context,
  }) => {
    // «Every account is listed», «Accounts without organization are found»,
    // «Assigning two organizations at once».
    const fresh = await createFreshOrganization();
    const account = await createAccountWithoutOrganization();
    const [b, c] = await Promise.all([
      platformOrganization("Asignación B"),
      platformOrganization("Asignación C"),
    ]);
    await login(page, SEED_PLATFORM_ADMIN);

    await page.goto(`/admin/users?q=${encodeURIComponent(fresh.email)}`);
    await expect(visibleRows(page, "user-row")).toContainText(fresh.organizationName);
    await expect(visibleRows(page, "user-row")).toContainText("Dueña o dueño");

    await page.goto("/admin/users");
    await page.getByLabel("Buscar cuenta por correo o nombre").fill(account.email);
    await page.getByLabel("Sin organización", { exact: true }).check();
    await page.getByRole("button", { name: "Filtrar" }).click();
    const row = visibleRows(page, "user-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Sin organización");

    await row.getByRole("link", { name: account.email }).click();
    await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/);

    // Que el filtro oculte a C es la prueba de que la página ya se hidrató:
    // antes de eso, marcar la casilla no cambia nada.
    await expect(page.getByLabel(c.name, { exact: true })).toBeVisible();
    await page.getByLabel("Filtrar organizaciones").fill(b.name);
    await expect(page.getByLabel(c.name, { exact: true })).toHaveCount(0);
    await page.getByLabel(b.name, { exact: true }).check();
    await page.getByLabel(`Rol en ${b.name}`).selectOption("owner");
    await page.getByLabel("Filtrar organizaciones").fill(c.name);
    await page.getByLabel(c.name, { exact: true }).check();
    await page.getByRole("button", { name: "Asignar" }).click();
    await expect(page.getByTestId("assignment-report")).toHaveText(
      `${b.name}: agregada · ${c.name}: agregada`,
    );

    // La cuenta entra, elige B y es su dueña. Sin «Cerrar sesión»: el cierre
    // de Supabase es global y cortaría la sesión del super admin de la
    // semilla en las demás pruebas que corren en paralelo. Basta con olvidar
    // las cookies de este navegador.
    await context.clearCookies();
    await login(page, account.email);
    await expect(page).toHaveURL(/\/auth\/select-org/);
    await page.getByRole("button", { name: b.name }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Configuración" })).toBeVisible();
    await expect(page.getByTestId("organization-switcher")).toHaveCount(0);
  });
});

test.describe("agregar usuario desde Usuarios", () => {
  test("agrega una cuenta existente y luego la ve en la tabla con su organización", async ({
    page,
  }) => {
    // «Adding an existing account from the Users view», «Adding someone who
    // already belongs is reported».
    const account = await createAccountWithoutOrganization();
    const organization = await platformOrganization("Agregar");
    await login(page, SEED_PLATFORM_ADMIN);
    await page.goto("/admin/users");

    await page.getByRole("button", { name: "Agregar usuario" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Correo").fill(account.email);
    await dialog.getByLabel("Organización").selectOption({ label: organization.name });
    await dialog.getByLabel("Rol").selectOption("owner");
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(dialog.getByTestId("add-user-result")).toHaveText(
      `${account.email} ya es parte de ${organization.name}.`,
    );

    // Repetirlo no cambia nada, y lo dice. El formulario se vacía tras
    // agregar, así que se vuelve a llenar.
    await dialog.getByLabel("Correo").fill(account.email);
    await dialog.getByLabel("Organización").selectOption({ label: organization.name });
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(dialog.getByTestId("add-user-result")).toContainText("ya pertenecía");
    await page.keyboard.press("Escape");

    await page.goto(`/admin/users?q=${encodeURIComponent(account.email)}`);
    const row = visibleRows(page, "user-row");
    await expect(row).toContainText(organization.name);
    await expect(row).toContainText("Dueña o dueño");
  });
});

test.describe("selector de organización", () => {
  test.skip(({ isMobile }) => isMobile, "el selector vive en el menú lateral de escritorio");

  test("cambia de organización y sale a la vista de plataforma", async ({ page }) => {
    // «Switching organization from the sidebar», «Leaving to the platform
    // view».
    const [a, b] = await Promise.all([
      platformOrganization("Selector A"),
      platformOrganization("Selector B"),
    ]);
    await login(page, SEED_PLATFORM_ADMIN);
    await enterFromList(page, a.name);
    await expect(page.getByTestId("organization-switcher")).toContainText(a.name);

    await page.getByTestId("organization-switcher").click();
    await page.getByLabel("Buscar organización").fill(b.name);
    await page.getByRole("menuitem", { name: b.name }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("top-bar")).toContainText(b.name);
    await expect(page.getByTestId("organization-switcher")).toContainText(b.name);

    await page.getByTestId("organization-switcher").click();
    await page.getByRole("menuitem", { name: "Vista de plataforma" }).click();
    await expect(page).toHaveURL(/\/admin\/organizations$/);
    await expect(page.getByTestId("organization-switcher")).toContainText("Vista de plataforma");
    await expect(page.getByTestId("line-selector")).toHaveCount(0);
  });
});

test.describe("bitácora", () => {
  test.skip(({ isMobile }) => isMobile, "la bitácora completa es de escritorio");

  test("la dueña ve la marca del administrador de la plataforma", async ({ page }) => {
    // «A foreign change is marked», «The owner sees the mark».
    const copy = geeko();
    const owner = await signedInClient(copy.owner);
    const { data: orders } = await owner
      .from("orders")
      .select("id")
      .eq("organization_id", copy.organizationId)
      .limit(1);
    const orderId = orders?.[0]?.id as string;

    const admin = await signedInClient(SEED_PLATFORM_ADMIN);
    const { error } = await admin
      .from("orders")
      .update({ notes: `Revisado por soporte ${suffix()}` })
      .eq("id", orderId)
      .eq("organization_id", copy.organizationId);
    expect(error).toBeNull();

    await login(page, copy.owner);
    await page.goto("/activity");
    await expect(
      page.getByTestId("activity-row").filter({ hasText: "Administrador de la plataforma" }).first(),
    ).toBeVisible();

    await page.goto(`/orders/${orderId}`);
    await expect(
      page.getByTestId("history-entry").filter({ hasText: "Administrador de la plataforma" }).first(),
    ).toBeVisible();
  });
});

test.describe("revocación", () => {
  test("revocar surte efecto en la siguiente navegación", async ({ page }) => {
    // «Revoking takes effect on the next request» en la interfaz.
    const admin = await createPlatformAdmin();
    const organization = await platformOrganization("Revocación");
    await login(page, admin.email);
    await enterFromList(page, organization.name);
    await expect(page).toHaveURL(/\/(dashboard|quick)$/);

    await revokePlatformAdmin(admin.userId);

    await page.reload();
    await expect(page.getByText(/no pertenece a ninguna organización/)).toBeVisible();
    await expect(page.getByText(organization.name)).toHaveCount(0);

    await page.goto("/admin/organizations");
    await expect(page).not.toHaveURL(/\/admin\/organizations/);
    await expect(page.getByTestId("organization-list")).toHaveCount(0);
  });
});

test.describe("super admin en el celular", () => {
  test.skip(({ isMobile }) => !isMobile, "solo el proyecto móvil");

  test("«Más» lleva las secciones de plataforma y la barra conserva sus cuatro ranuras", async ({
    page,
  }) => {
    // «Mobile carries them in "Más"».
    const organization = await platformOrganization("Móvil");
    await login(page, SEED_PLATFORM_ADMIN);
    await enterFromList(page, organization.name);
    await expect(page).toHaveURL(/\/quick$/);

    const bar = page.getByTestId("bottom-bar");
    await expect(bar.getByRole("link")).toHaveCount(3);
    await expect(page.getByTestId("bottom-bar-more")).toBeVisible();

    await page.getByTestId("bottom-bar-more").click();
    const panel = page.getByTestId("more-panel");
    await expect(panel.getByRole("link", { name: "Organizaciones" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Usuarios" })).toBeVisible();
  });

  test("las vistas de plataforma no desbordan a 390 px", async ({ page }) => {
    // «Platform views at 390 px».
    const fresh = await createFreshOrganization();
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, SEED_PLATFORM_ADMIN);

    await page.goto("/admin/organizations");
    await expect(page.getByTestId("organization-list")).toBeVisible();
    expect(await desbordaHorizontalmente(page)).toBe(false);

    await page.goto(`/admin/organizations/${fresh.organizationId}`);
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();
    expect(await desbordaHorizontalmente(page)).toBe(false);

    await page.goto("/admin/users");
    await expect(page.getByTestId("user-list")).toBeVisible();
    expect(await desbordaHorizontalmente(page)).toBe(false);

    await page.goto(`/admin/users/${fresh.userId}`);
    await expect(page.getByRole("button", { name: "Guardar nombre" })).toBeVisible();
    expect(await desbordaHorizontalmente(page)).toBe(false);
  });
});
