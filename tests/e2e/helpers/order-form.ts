import { expect, type Page } from "./test";

/**
 * Los pasos del formulario de pedido que pasan por diálogos
 * (`order-form-picker-dialogs`, design D10). Viven aquí para que un cambio de
 * la interfaz toque un solo archivo y no cada suite que registra un pedido.
 */

/** Un nombre como parte de una expresión regular, sin metacaracteres sueltos. */
function literal(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** El control que abre el diálogo de cliente: «Seleccionar» o «Cambiar». */
export function disparadorCliente(page: Page) {
  return page.locator("#order-customer-trigger");
}

/** El campo de cliente del formulario, con lo que muestre ahora mismo. */
export function campoCliente(page: Page) {
  return page.getByRole("group", { name: "Cliente" });
}

async function abrirDialogoCliente(page: Page) {
  await disparadorCliente(page).click();
  const dialog = page.getByRole("dialog", { name: "Seleccionar cliente" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Abre el diálogo, filtra, elige al cliente y confirma. */
export async function elegirCliente(
  page: Page,
  nombre: string,
  { filtro = nombre }: { filtro?: string } = {},
) {
  const dialog = await abrirDialogoCliente(page);
  await dialog.getByRole("combobox", { name: "Buscar un cliente" }).fill(filtro);
  await dialog.getByRole("option", { name: new RegExp(literal(nombre)) }).click();
  await dialog.getByRole("button", { name: "Seleccionar cliente" }).click();
  await expect(dialog).toBeHidden();
  await expect(campoCliente(page)).toContainText(nombre);
}

/**
 * Registra un cliente desde el diálogo y lo deja seleccionado. Con
 * `desdeFiltro` se escribe el nombre en el filtro y se usa «Registrar «…»»;
 * sin él, «Registrar nuevo cliente» y el nombre se escribe en el formulario.
 */
export async function registrarCliente(
  page: Page,
  {
    nombre,
    telefono,
    correo,
    direccion,
    desdeFiltro = true,
  }: {
    nombre: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
    desdeFiltro?: boolean;
  },
) {
  const dialog = await abrirDialogoCliente(page);

  if (desdeFiltro) {
    await dialog.getByRole("combobox", { name: "Buscar un cliente" }).fill(nombre);
    await dialog.getByRole("button", { name: `Registrar «${nombre}»` }).click();
  } else {
    await dialog.getByRole("button", { name: "Registrar nuevo cliente" }).click();
  }

  const form = page.getByRole("dialog", { name: "Registrar cliente" });
  const nombreCampo = form.getByLabel("Nombre");
  if (desdeFiltro) {
    await expect(nombreCampo).toHaveValue(nombre);
  } else {
    await nombreCampo.fill(nombre);
  }
  if (telefono) await form.getByLabel("Teléfono").fill(telefono);
  if (correo) await form.getByLabel("Correo").fill(correo);
  if (direccion) await form.getByLabel("Dirección").fill(direccion);

  await form.getByRole("button", { name: "Crear y seleccionar" }).click();
  await expect(form).toBeHidden();
  await expect(campoCliente(page)).toContainText(nombre);
}

export type ProductoAElegir = string | { producto: string; variante: string };

/**
 * Abre «Agregar del catálogo», marca cada producto (filtrando por su nombre)
 * y confirma. Un producto con variantes se nombra con la suya.
 */
export async function agregarDelCatalogo(page: Page, productos: ProductoAElegir[]) {
  await page.getByRole("button", { name: "Agregar del catálogo" }).click();
  const dialog = page.getByRole("dialog", { name: "Agregar del catálogo" });
  await expect(dialog).toBeVisible();
  const filtro = dialog.getByRole("combobox", { name: "Buscar un producto" });

  for (const elegido of productos) {
    const { producto, variante } =
      typeof elegido === "string" ? { producto: elegido, variante: null } : elegido;
    await filtro.fill(producto);
    const nombre = variante
      ? new RegExp(`${literal(producto)}.*${literal(variante)}`)
      : new RegExp(literal(producto));
    await dialog.getByRole("option", { name: nombre }).first().click();
  }

  await dialog
    .getByRole("button", { name: `Agregar (${productos.length})` })
    .click();
  await expect(dialog).toBeHidden();
}

/**
 * El detalle de un pedido. La consulta es opcional: al llegar desde la
 * pantalla de pedidos, la dirección lleva `?from=` con la vista de origen
 * (spec `navigation-breadcrumbs`).
 */
export const ORDER_DETAIL = /\/orders\/[0-9a-f]{8}-[0-9a-f-]{27}(\?.*)?$/;

/**
 * «Guardar» en el alta vuelve a la pantalla de pedidos con el número a la
 * vista (`navigation-breadcrumbs-and-all-lines-board`). Espera esa vuelta y
 * devuelve el número; el clic en «Guardar» lo da quien llama.
 */
export async function esperarPedidoGuardado(page: Page): Promise<string> {
  const aviso = page.getByTestId("order-created-notice");
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/orders(\?.*)?$/);
  const code = (await aviso.textContent())?.match(/#(\d+)/)?.[1];
  if (!code) throw new Error("El aviso de pedido guardado no trae número");
  return code;
}

/** Abre el detalle de un pedido desde la lista, por su número. */
export async function abrirPedido(page: Page, code: string): Promise<void> {
  await page.goto("/orders?view=list");
  // `exact`: «#5» no debe casar con «#50».
  await page.getByRole("link", { name: `#${code}`, exact: true }).click();
  await page.waitForURL(ORDER_DETAIL);
}

/**
 * Guarda el alta y abre el detalle del pedido recién creado, para las suites
 * que siguen trabajando sobre él.
 */
export async function guardarYAbrirPedido(page: Page): Promise<string> {
  await page.getByTestId("save-order").click();
  const code = await esperarPedidoGuardado(page);
  await abrirPedido(page, code);
  return code;
}
