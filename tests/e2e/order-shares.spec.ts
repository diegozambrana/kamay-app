import {
  createFreshOrganization,
  E2E_PASSWORD,
  signedInClient,
} from "./helpers/fresh-org";
import {
  agregarDelCatalogo,
  esperarPedidoGuardado,
  registrarCliente,
} from "./helpers/order-form";
import { expect, test, type Page } from "./helpers/test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * KAM-32 · El enlace público de seguimiento del pedido, de punta a punta
 * contra la base real: lo que las pruebas unitarias y pgTAP no pueden cubrir
 * con dobles — el recorrido completo en el navegador, sin sesión, con RLS de
 * verdad.
 *
 * Una organización propia y desechable (`createFreshOrganization`), nunca
 * Geeko, por la misma razón que `order-requests.spec.ts` de KAM-28: revocar
 * un enlace y dejarlo sin servir no debe poder interferir con otra prueba que
 * corra en paralelo sobre la misma organización.
 */
test.describe("enlace público de seguimiento del pedido", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "no depende del dispositivo de quien prueba");

  test("generar, ver la vista previa, comentar sin sesión, leer el comentario y revocar", async ({
    page,
    browser,
  }) => {
    const organization = await createFreshOrganization();
    const productName = `Taza compartida ${Date.now()}`;
    const clientName = "Cliente del enlace público";

    const owner = await signedInClient(organization.email);
    const { data: linea, error: lineaError } = await owner
      .from("business_lines")
      .select("id")
      .eq("organization_id", organization.organizationId)
      .eq("name", organization.lineName)
      .single();
    if (lineaError || !linea) throw new Error(`línea: ${lineaError?.message}`);
    const { error: itemError } = await owner.from("items").insert({
      organization_id: organization.organizationId,
      business_line_id: linea.id,
      kind: "product",
      name: productName,
      sale_price: 30,
    });
    if (itemError) throw new Error(`producto: ${itemError.message}`);

    await login(page, organization.email);
    await page.goto("/orders/new");
    await page.getByTestId("line-select").click();
    await page.getByRole("option", { name: organization.lineName, exact: true }).click();
    await registrarCliente(page, { nombre: clientName });
    await agregarDelCatalogo(page, [productName]);
    await page.getByTestId("save-order").click();
    const code = await esperarPedidoGuardado(page);
    await page.goto("/orders?view=list");
    await page.getByRole("link", { name: `#${code}`, exact: true }).click();
    await page.waitForURL(/\/orders\/[0-9a-f-]+(\?.*)?$/);

    // «Así lo verá tu cliente»: la vista previa antes de activar el enlace.
    await page.getByRole("button", { name: "Generar enlace" }).click();
    const previewDialog = page.getByRole("alertdialog", { name: "Así lo verá tu cliente" });
    await expect(previewDialog).toBeVisible();
    await expect(previewDialog.getByText(productName)).toBeVisible();
    await previewDialog.getByRole("button", { name: "Activar y generar enlace" }).click();

    const urlBlock = page.getByTestId("share-url");
    await expect(urlBlock).toBeVisible();
    const url = (await urlBlock.locator("code").textContent())?.trim();
    if (!url) throw new Error("El bloque de compartir no mostró el enlace generado.");
    expect(url).toMatch(/\/p\/[^/]+$/);

    // Quien recibe el enlace no tiene sesión ni cuenta en Kamay.
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(url);

    await expect(guest.getByText(`Pedido #${code}`)).toBeVisible();
    await expect(guest.getByRole("cell", { name: productName })).toBeVisible();
    await expect(guest.getByTestId("public-order-total")).toContainText("30.00");

    const commentBody = `Todo bien, gracias ${Date.now()}`;
    await guest.getByLabel("Tu nombre").fill(clientName);
    await guest.getByLabel("Comentario").fill(commentBody);
    await guest.getByRole("button", { name: "Enviar comentario" }).click();
    await expect(guest.getByText("Gracias por tu comentario")).toBeVisible({ timeout: 15_000 });

    // El comentario se lee en el detalle, del lado de la organización.
    await page.reload();
    const comment = page.getByTestId("order-comment").filter({ hasText: commentBody });
    await expect(comment).toBeVisible();
    await expect(comment).toContainText(clientName);

    // Revocar corta el acceso de inmediato; los comentarios ya dejados no se
    // pierden (solo se afirma el corte de acceso aquí — el comentario ya se
    // comprobó arriba, y no depende de la revocación).
    await page.getByRole("button", { name: "Revocar" }).click();
    const revokeDialog = page.getByRole("alertdialog", { name: "¿Revocar el enlace?" });
    await expect(revokeDialog).toBeVisible();
    await revokeDialog.getByRole("button", { name: "Revocar" }).click();
    // `revalidatePath` trae de vuelta el bloque a su estado inicial: sin
    // enlace vigente, listo para generar uno nuevo si hace falta.
    await expect(page.getByRole("button", { name: "Generar enlace" })).toBeVisible();

    await guest.reload();
    await expect(guest.getByText("Este enlace no sirve")).toBeVisible();

    await guestContext.close();
  });
});
