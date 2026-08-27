import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test"; // dueña de Geeko Store
const GEEKO_ASSISTANT = "ayudante@kamay.test"; // ayudante de Geeko Store

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

/** Abre el menú de tres puntos de una fila del catálogo y elige una acción. */
async function rowAction(page: Page, name: string, action: string) {
  const row = page.getByTestId("catalog-row").filter({ hasText: name });
  await row.getByRole("button", { name: "Acciones" }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

test.describe("catálogo y directorio (V10, V11, V13)", () => {
  test("archivar y desarchivar devuelve el ítem intacto con sus variantes", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    // ── Crear un ítem y darle una variante ────────────────────────────────
    const name = uniqueName("Taza de prueba");
    await page.goto("/catalog?kind=product");
    await page.getByRole("button", { name: "Nuevo ítem" }).click();
    const form = page.getByTestId("item-form");
    await form.getByLabel("Nombre").fill(name);
    await form.getByLabel("Precio de venta referencial").fill("45");
    await form.getByRole("button", { name: "Crear ítem" }).click();

    const row = page.getByTestId("catalog-row").filter({ hasText: name });
    await expect(row).toHaveCount(1);

    // El detalle se abre desde el menú de acciones de la fila.
    await rowAction(page, name, "Ver");
    await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);
    const itemUrl = page.url();

    // El alta de variante también es un diálogo: se trabaja dentro de él.
    await page.getByRole("button", { name: "Agregar variante" }).click();
    const variantForm = page.getByTestId("variant-form");
    await variantForm.getByLabel("Nombre").fill("11oz");
    await variantForm.getByRole("button", { name: "Agregar variante" }).click();
    await expect(
      page.getByTestId("variant-row").filter({ hasText: "11oz" }),
    ).toHaveCount(1);

    // ── Archivar: desaparece del listado y de los buscadores ──────────────
    await page.getByRole("button", { name: "Archivar" }).first().click();
    await expect(page.getByTestId("item-archived-badge")).toBeVisible();
    // Un archivado no se edita: la única acción es devolverlo.
    await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);

    await page.goto("/catalog?kind=product");
    await expect(
      page.getByTestId("catalog-row").filter({ hasText: name }),
    ).toHaveCount(0);

    // Tampoco lo encuentra la búsqueda mientras siga archivado.
    await page.goto(`/catalog?kind=product&q=${encodeURIComponent(name)}`);
    await expect(page.getByTestId("catalog-row")).toHaveCount(0);

    // ── Desarchivar desde "Ver archivados": vuelve intacto ────────────────
    await page.goto("/catalog?kind=product&archived=1");
    const archivedRow = page.getByTestId("catalog-row").filter({ hasText: name });
    await expect(archivedRow).toHaveAttribute("data-archived", "true");
    await rowAction(page, name, "Desarchivar");

    await page.goto("/catalog?kind=product");
    await expect(
      page.getByTestId("catalog-row").filter({ hasText: name }),
    ).toHaveCount(1);

    await page.goto(itemUrl);
    await expect(page.getByTestId("item-archived-badge")).toHaveCount(0);
    // Sus variantes hicieron el viaje completo sin perderse.
    await expect(
      page.getByTestId("variant-row").filter({ hasText: "11oz" }),
    ).toHaveCount(1);

    // El precio y la línea siguen como estaban.
    await expect(page.getByTestId("item-general")).toContainText("45.00");
  });

  test("un contacto archivado vuelve entero desde el filtro", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    const name = uniqueName("Proveedor de prueba");
    await page.goto("/contacts");
    await page.getByRole("button", { name: "Nuevo contacto" }).click();
    const form = page.getByTestId("contact-form");
    await form.getByLabel("Nombre").fill(name);
    await form.getByLabel("Teléfono").fill("+591 70012345");
    await form.getByLabel("Proveedor").check();
    await form.getByRole("button", { name: "Crear contacto" }).click();

    const row = page.getByTestId("contact-row").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await row.click();

    await page
      .getByTestId("contact-detail")
      .getByRole("button", { name: "Archivar" })
      .click();
    await expect(
      page.getByTestId("contact-row").filter({ hasText: name }),
    ).toHaveCount(0);

    await page.getByTestId("contacts-archived").check();
    const archived = page.getByTestId("contact-row").filter({ hasText: name });
    await expect(archived).toHaveAttribute("data-archived", "true");
    await archived.click();
    await page.getByRole("button", { name: "Desarchivar" }).click();

    await page.goto("/contacts");
    await page.getByTestId("contact-row").filter({ hasText: name }).click();
    // Vuelve con sus datos, no como un contacto en blanco.
    await expect(page.getByTestId("contact-detail")).toContainText(
      "+591 70012345",
    );
  });

  test("el ayudante crea y edita, pero no se le ofrece archivar", async ({
    page,
  }) => {
    await login(page, GEEKO_ASSISTANT);

    // Crear un ítem: el ayudante sí puede.
    const itemName = uniqueName("Insumo del ayudante");
    await page.goto("/catalog?kind=supply");
    await page.getByRole("button", { name: "Nuevo ítem" }).click();
    const itemForm = page.getByTestId("item-form");
    await itemForm.getByLabel("Nombre").fill(itemName);
    await itemForm.getByRole("button", { name: "Crear ítem" }).click();

    const itemRow = page.getByTestId("catalog-row").filter({ hasText: itemName });
    await expect(itemRow).toHaveCount(1);

    // Ocultar, no deshabilitar: la acción no existe para su rol.
    await itemRow.getByRole("button", { name: "Acciones" }).click();
    await expect(page.getByRole("menuitem", { name: "Archivar" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Editar" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Editar: también puede.
    const edited = `${itemName} editado`;
    await rowAction(page, itemName, "Ver");
    await page.getByRole("button", { name: "Editar" }).click();
    await page.getByTestId("item-form").getByLabel("Nombre").fill(edited);
    await page
      .getByTestId("item-form")
      .getByRole("button", { name: "Guardar cambios" })
      .click();
    await expect(page.getByRole("heading", { name: edited })).toBeVisible();
    await expect(page.getByRole("button", { name: "Archivar" })).toHaveCount(0);
    // El historial es de la bitácora, que solo lee el dueño.
    await expect(page.getByRole("heading", { name: "Historial" })).toHaveCount(0);

    // Contactos: mismo trato.
    const contactName = uniqueName("Cliente del ayudante");
    await page.goto("/contacts");
    await page.getByRole("button", { name: "Nuevo contacto" }).click();
    const contactForm = page.getByTestId("contact-form");
    await contactForm.getByLabel("Nombre").fill(contactName);
    await contactForm.getByRole("button", { name: "Crear contacto" }).click();

    await page.getByTestId("contact-row").filter({ hasText: contactName }).click();
    const detail = page.getByTestId("contact-detail");
    await expect(detail.getByRole("button", { name: "Editar" })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Archivar" })).toHaveCount(0);
  });

  test("la foto adjunta aparece como miniatura y archivar pide confirmación", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    const name = uniqueName("Ítem con foto");
    await page.goto("/catalog?kind=product");
    await page.getByRole("button", { name: "Nuevo ítem" }).click();

    const form = page.getByTestId("item-form");
    await form.getByLabel("Nombre").fill(name);

    // Un PNG de 1×1 real: el bucket solo acepta imágenes.
    await form.getByLabel("Arrastra la foto del ítem").setInputFiles({
      name: "taza.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });

    // La zona de arrastre muestra el archivo elegido con su peso antes de subir.
    await expect(page.getByTestId("file-dropzone-list")).toContainText("taza.png");
    await expect(page.getByTestId("file-preview-image")).toBeVisible();

    await form.getByRole("button", { name: "Crear ítem" }).click();

    const row = page.getByTestId("catalog-row").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    // La miniatura llega firmada desde el servidor: el bucket es privado.
    await expect(row.getByTestId("item-thumbnail").locator("img")).toHaveAttribute(
      "src",
      /token=/,
    );

    // ── La misma foto se ve en el detalle ─────────────────────────────────
    await rowAction(page, name, "Ver");
    await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/);

    const photo = page.getByTestId("item-photo");
    await expect(photo).toContainText("taza.png");
    await expect(photo.getByRole("img")).toHaveAttribute("src", /token=/);

    await page.goto("/catalog?kind=product");

    // ── Archivar desde el menú pide confirmación ──────────────────────────
    const row2 = page.getByTestId("catalog-row").filter({ hasText: name });
    await row2.getByRole("button", { name: "Acciones" }).click();
    await page.getByRole("menuitem", { name: "Archivar" }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("¿Archivar este ítem?");

    // Cancelar no archiva nada.
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(
      page.getByTestId("catalog-row").filter({ hasText: name }),
    ).toHaveCount(1);

    // Confirmar sí.
    await rowAction(page, name, "Archivar");
    await page.getByRole("alertdialog").getByRole("button", { name: "Archivar" }).click();
    await expect(
      page.getByTestId("catalog-row").filter({ hasText: name }),
    ).toHaveCount(0);
  });

  test("buscar sin tilde encuentra el ítem con tilde", async ({ page }) => {
    await login(page, GEEKO_OWNER);

    await page.goto("/catalog?kind=supply&q=sublimacion");

    await expect(
      page.getByTestId("catalog-row").filter({ hasText: "Taza para sublimación" }),
    ).toHaveCount(1);
  });

  test("crear un contacto al vuelo lo deja seleccionado sin perder el formulario", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    // El buscador reutilizable se estrena en el alta de contacto de V13: se
    // comprueba que el nombre tecleado que no existe ofrece crearlo.
    await page.goto("/contacts");
    const name = uniqueName("Al vuelo");
    // El nombre no existe: el buscador ofrece crearlo sin abrir el formulario.
    await page.getByLabel("Buscar o crear").fill(name);
    await page.getByRole("button", { name: `Crear «${name}»` }).click();

    // Queda seleccionado en el panel derecho, listo para completar sus datos.
    await expect(page.getByTestId("contact-detail")).toContainText(name);

    // Y existe de verdad: aparece en el directorio con su rol.
    await page.goto(`/contacts?q=${encodeURIComponent(name)}`);
    await expect(
      page.getByTestId("contact-row").filter({ hasText: name }),
    ).toHaveCount(1);
  });
});
