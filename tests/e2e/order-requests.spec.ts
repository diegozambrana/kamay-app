import {
  adminClient,
  createFreshOrganization,
  E2E_PASSWORD,
  signedInClient,
} from "./helpers/fresh-org";
import {
  abrirPedido,
  agregarDelCatalogo,
  esperarPedidoGuardado,
  registrarCliente,
} from "./helpers/order-form";
import { noisePng } from "./helpers/png";
import { expect, test, type Page } from "./helpers/test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/** El identificador de la línea "Sublimación" que siembra `createFreshOrganization`. */
async function lineaSublimacion(email: string, organizationId: string): Promise<string> {
  const owner = await signedInClient(email);
  const { data, error } = await owner
    .from("business_lines")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", "Sublimación")
    .single();
  if (error || !data) throw new Error(`línea: ${error?.message ?? "no encontrada"}`);
  return data.id;
}

/** Genera una solicitud desde la bandeja y devuelve el enlace público. */
async function generarSolicitud(
  page: Page,
  { linea, nombre, telefono }: { linea: string; nombre: string; telefono: string },
): Promise<string> {
  await page.goto("/orders/requests");
  await page.getByRole("button", { name: "Generar solicitud" }).click();
  const dialog = page.getByTestId("generate-request-dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Línea").click();
  await page.getByRole("option", { name: linea, exact: true }).click();
  await dialog.getByLabel("Nombre").fill(nombre);
  await dialog.getByLabel("Teléfono").fill(telefono);
  await dialog.getByRole("button", { name: "Generar" }).click();

  const urlBlock = dialog.getByTestId("request-url");
  await expect(urlBlock).toBeVisible();
  const url = (await urlBlock.locator("code").textContent())?.trim();
  if (!url) throw new Error("El diálogo no mostró el enlace generado.");
  return url;
}

/**
 * KAM-28 · La solicitud de pedido por enlace público, de punta a punta contra
 * la base real: lo que `actions/order-requests.test.ts` no puede cubrir con
 * dobles — RLS de verdad, la política de Storage para `anon`, y el recorrido
 * completo en el navegador.
 *
 * Cada prueba usa su propia organización desechable (`createFreshOrganization`),
 * nunca la semilla de Geeko: el criterio 5 exige que ninguna política del
 * esquema público conceda nada a `anon` salvo lo que las dos funciones de
 * `resolve_order_request`/`submit_order_request` necesitan, y una carrera con
 * otra prueba sobre la misma organización lo haría frágil.
 */
test.describe("solicitudes de pedido por enlace público", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "no depende del dispositivo de quien prueba");

  // Scenario: A public visitor submits their contact details and photos
  test("el enlace llega con el teléfono prellenado, admite una foto y confirma el envío", async ({
    page,
    browser,
  }) => {
    const organization = await createFreshOrganization();
    const telefono = "70011122";
    const nombre = "Cliente del enlace";

    await login(page, organization.email);
    const url = await generarSolicitud(page, {
      linea: organization.lineName,
      nombre,
      telefono,
    });
    expect(url).toMatch(/\/r\/[^/]+$/);

    // Quien recibe el enlace no tiene sesión ni cuenta en Kamay.
    const context = await browser.newContext();
    const guest = await context.newPage();
    await guest.goto(url);

    await expect(guest.getByText(`Pedido a ${organization.organizationName}`)).toBeVisible();
    await expect(guest.getByLabel("Tu teléfono")).toHaveValue(telefono);
    await expect(guest.getByLabel("Tu nombre")).toHaveValue(nombre);

    await guest
      .getByLabel("Imágenes de referencia (opcional)")
      .setInputFiles({ name: "referencia.png", mimeType: "image/png", buffer: noisePng(60, 60) });
    await expect(guest.getByTestId("file-dropzone-list")).toContainText("referencia.png");

    await guest.getByRole("button", { name: "Mandar mis datos" }).click();
    await expect(guest.getByText("Listo, lo recibimos")).toBeVisible({ timeout: 15_000 });
    await expect(
      guest.getByText(`${organization.organizationName} ya tiene tus datos.`),
    ).toBeVisible();

    await context.close();
  });

  // Scenario: An expired link shows a generic message without exposing the organization
  test("un enlace vencido muestra el mensaje genérico y no revela la organización", async ({
    page,
    browser,
  }) => {
    const organization = await createFreshOrganization();

    await login(page, organization.email);
    const url = await generarSolicitud(page, {
      linea: organization.lineName,
      nombre: "Cliente que ya no alcanza",
      telefono: "70099887",
    });

    // Nada en la interfaz deja vencer un enlace en el momento: se retrasa
    // `expires_at` con la propia sesión de la dueña, como haría el paso del
    // tiempo. El disparador `guard_order_request_updates()` lo permite
    // mientras la solicitud siga "esperando al cliente" (design D9).
    const owner = await signedInClient(organization.email);
    const { data: request, error: findError } = await owner
      .from("order_requests")
      .select("id")
      .eq("organization_id", organization.organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (findError || !request) throw new Error(`solicitud: ${findError?.message}`);

    const { error: expireError } = await owner
      .from("order_requests")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", request.id);
    if (expireError) throw new Error(`vencer: ${expireError.message}`);

    const context = await browser.newContext();
    const guest = await context.newPage();
    await guest.goto(url);

    await expect(guest.getByText("Este enlace no sirve")).toBeVisible();
    const body = await guest.locator("body").innerText();
    expect(body).not.toContain(organization.organizationName);

    await context.close();
  });

  // Scenario: Accepting from the inbox reuses the intake and carries over attachments
  test("un ayudante acepta desde la bandeja y el pedido conserva la foto adjunta", async ({
    page,
    browser,
  }) => {
    const organization = await createFreshOrganization();
    const admin = adminClient();

    const assistantSuffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    const assistantEmail = `ayudante-solicitud-${assistantSuffix}@kamay.test`;
    const { data: assistantUser, error: assistantError } = await admin.auth.admin.createUser({
      email: assistantEmail,
      password: E2E_PASSWORD,
      email_confirm: true,
    });
    if (assistantError) throw new Error(`ayudante: ${assistantError.message}`);
    const { error: membershipError } = await admin.from("memberships").insert({
      organization_id: organization.organizationId,
      user_id: assistantUser.user.id,
      role: "assistant",
    });
    if (membershipError) throw new Error(`membresía: ${membershipError.message}`);

    const lineaId = await lineaSublimacion(organization.email, organization.organizationId);
    const productName = `Taza de la solicitud ${assistantSuffix}`;
    const owner = await signedInClient(organization.email);
    const { error: itemError } = await owner.from("items").insert({
      organization_id: organization.organizationId,
      business_line_id: lineaId,
      kind: "product",
      name: productName,
      sale_price: 45,
    });
    if (itemError) throw new Error(`producto: ${itemError.message}`);

    const nombre = "Cliente que sí se acepta";
    await login(page, organization.email);
    const url = await generarSolicitud(page, {
      linea: organization.lineName,
      nombre,
      telefono: "70055443",
    });

    // El cliente manda sus datos y una foto de referencia, sin sesión.
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(url);
    await guest
      .getByLabel("Imágenes de referencia (opcional)")
      .setInputFiles({ name: "adjunto.png", mimeType: "image/png", buffer: noisePng(60, 60) });
    await guest.getByRole("button", { name: "Mandar mis datos" }).click();
    await expect(guest.getByText("Listo, lo recibimos")).toBeVisible({ timeout: 15_000 });
    await guestContext.close();

    // Un ayudante — no la dueña que generó el enlace — completa el recorrido
    // de aceptar de punta a punta, en su propia sesión.
    const assistantContext = await browser.newContext();
    const assistantPage = await assistantContext.newPage();
    await login(assistantPage, assistantEmail);

    await assistantPage.goto("/orders/requests");
    const row = assistantPage.getByTestId("order-request-row").filter({ hasText: nombre });
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: nombre }).click();
    await assistantPage.waitForURL(/\/orders\/requests\/[0-9a-f-]+$/);

    await expect(assistantPage.getByText("Recibida")).toBeVisible();
    await assistantPage.getByRole("button", { name: "Aceptar" }).click();
    await assistantPage.waitForURL(/\/orders\/new\?request=/);

    await expect(assistantPage.getByTestId("line-select")).toContainText(organization.lineName);
    // La solicitud no traía un cliente del directorio (nadie lo eligió al
    // generar el enlace): el alta lo exige igual que cualquier otro pedido,
    // y solo dejó la nota con los datos del cliente como cortesía.
    await registrarCliente(assistantPage, { nombre, telefono: "70055443" });
    await agregarDelCatalogo(assistantPage, [productName]);
    await assistantPage.getByTestId("save-order").click();
    const code = await esperarPedidoGuardado(assistantPage);
    await abrirPedido(assistantPage, code);

    // «Aceptar» dejó la solicitud vinculada a este mismo pedido, con la foto
    // que el cliente mandó ya copiada a sus adjuntos (`accept()` la sube con
    // un nombre de archivo propio, no el original — por eso se cuenta y no
    // se busca el nombre).
    await expect(assistantPage.getByTestId("edit-order")).toBeVisible();
    await assistantPage.getByTestId("edit-order").click();
    await assistantPage.waitForURL(/\/orders\/[0-9a-f-]+\/edit(\?.*)?$/);
    await expect(assistantPage.getByTestId("order-attachments").locator("li")).toHaveCount(1);

    await assistantContext.close();
  });
});
