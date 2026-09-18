import { geeko } from "./helpers/seed-copies";
import {
  agregarDelCatalogo,
  campoCliente,
  disparadorCliente,
  elegirCliente,
  registrarCliente,
} from "./helpers/order-form";
import { expect, test, type Locator, type Page } from "./helpers/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";

/** El detalle de un pedido, para distinguirlo de `/orders/new`. */
const ORDER_DETAIL = /\/orders\/[0-9a-f]{8}-[0-9a-f-]+$/;

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/**
 * Cuenta interacciones de usuario para el criterio 7 del backlog: el
 * recorrido completo de alta debe completarse en menos de 15. Cada llamada es
 * un gesto — un clic o el relleno de un campo—, que es lo que cuesta a quien
 * está de pie en el taller con el celular en la mano.
 */
function medidor() {
  let total = 0;
  return {
    get total() {
      return total;
    },
    async clic(locator: Locator) {
      total += 1;
      await locator.click();
    },
    async escribir(locator: Locator, texto: string) {
      total += 1;
      await locator.fill(texto);
    },
  };
}

/** Elige la línea de negocio dentro del propio formulario. */
async function elegirLinea(page: Page, nombre: string) {
  await page.getByTestId("line-select").click();
  await page.getByRole("option", { name: nombre, exact: true }).click();
  await expect(page.getByTestId("line-select")).toContainText(nombre);
}


test.describe("alta de pedidos (V5)", () => {
  /**
   * El recorrido completo del Flujo A de la especificación: un encargo de 20
   * tazas con cliente, producto, variante, cantidad, fecha, canal, modo de
   * entrega y nota. Es "el recorrido completo de alta" que mide el criterio 7.
   *
   * La línea activa se fija antes de empezar a contar: elegir el contexto de
   * trabajo no es parte del alta, y en el menú lateral solo existe en
   * escritorio.
   */
  test("el alta completa se hace en menos de 15 interacciones", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "el selector de línea del menú es de escritorio");

    await login(page, geeko().owner);
    await page.getByTestId("line-selector").click();
    await page.getByRole("menuitem", { name: "Sublimación" }).click();
    await expect(page.getByTestId("line-selector")).toBeEnabled();

    await page.goto("/orders");

    const medida = medidor();

    await medida.clic(page.getByTestId("new-order"));
    await page.waitForURL(/\/orders\/new$/);

    // La línea activa llega preseleccionada: no cuesta ninguna interacción.
    await expect(page.getByTestId("line-select")).toContainText("Sublimación");

    // Cliente y producto se eligen en diálogos. El camino corto es tocar la
    // fila en la lista completa, sin escribir en el filtro: abrir, elegir y
    // confirmar. Filtrar suma un gesto por diálogo (16 en total), y con él
    // el recorrido ya no cabe en el criterio.
    await medida.clic(disparadorCliente(page));
    const clientes = page.getByRole("dialog", { name: "Seleccionar cliente" });
    await medida.clic(clientes.getByRole("option", { name: /María Céspedes/ }));
    await medida.clic(clientes.getByRole("button", { name: "Seleccionar cliente" }));
    await expect(campoCliente(page)).toContainText("María Céspedes");

    await medida.clic(page.getByRole("button", { name: "Agregar del catálogo" }));
    const catalogo = page.getByRole("dialog", { name: "Agregar del catálogo" });
    await medida.clic(catalogo.getByRole("option", { name: /Taza personalizada.*15oz/ }));
    await medida.clic(catalogo.getByRole("button", { name: "Agregar (1)" }));
    await expect(catalogo).toBeHidden();
    await medida.escribir(page.getByLabel("Cantidad"), "20");

    await medida.clic(page.getByRole("button", { name: "Mañana", exact: true }));

    await medida.clic(page.getByTestId("channel-select"));
    await medida.clic(page.getByRole("option", { name: "Redes", exact: true }));

    await medida.clic(page.getByRole("radio", { name: "Delivery" }));
    await medida.escribir(page.getByLabel("Nota"), "Diseño enviado por WhatsApp.");

    await expect(page.getByTestId("order-form-total")).toHaveText("1100.00");

    await medida.clic(page.getByTestId("save-order"));
    await page.waitForURL(ORDER_DETAIL);

    // La medición queda en el reporte, que es lo que pide el criterio 7.
    test.info().annotations.push({
      type: "interacciones del alta",
      description: String(medida.total),
    });
    expect(medida.total).toBeLessThan(15);

    // El pedido quedó completo y con su número.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("#");
    await expect(page.getByTestId("order-line")).toHaveCount(1);
    await expect(page.getByTestId("order-total")).toHaveText("1100.00");
    await expect(page.getByTestId("status-select")).toContainText("Registrado");
    await expect(
      page.locator('[data-testid="history-entry"][data-action="created"]'),
    ).toHaveCount(1);
  });

  test("un pedido admite varias líneas del catálogo", async ({ page }) => {
    await login(page, geeko().owner);
    await page.goto("/orders/new");

    await elegirLinea(page, "Sublimación");
    await elegirCliente(page, "María Céspedes");
    // Las dos variantes en un solo paso: el diálogo admite selección múltiple.
    await agregarDelCatalogo(page, [
      { producto: "Taza personalizada", variante: "11oz" },
      { producto: "Taza personalizada", variante: "15oz" },
    ]);

    // 45 + 55: cada línea nace con el precio referencial de su variante.
    const filas = page.getByTestId("order-line-row");
    await expect(filas.nth(0).getByLabel("Precio")).toHaveValue("45");
    await expect(filas.nth(1).getByLabel("Precio")).toHaveValue("55");
    await expect(page.getByTestId("order-form-total")).toHaveText("100.00");

    // El precio prellenado se edita, y el editado es el que se guarda.
    await filas.nth(0).getByLabel("Precio").fill("40");
    await expect(page.getByTestId("order-form-total")).toHaveText("95.00");

    await page.getByTestId("save-order").click();
    await page.waitForURL(ORDER_DETAIL);

    await expect(page.getByTestId("order-line")).toHaveCount(2);
    await expect(page.getByTestId("order-total")).toHaveText("95.00");

    // El catálogo no cambió: un pedido nuevo vuelve a nacer con 45.
    await page.goto("/orders/new");
    await elegirLinea(page, "Sublimación");
    await agregarDelCatalogo(page, [{ producto: "Taza personalizada", variante: "11oz" }]);
    await expect(page.getByLabel("Precio")).toHaveValue("45");
  });

  /**
   * Criterio 1 del backlog: con cliente y una línea se puede guardar aunque
   * falten fecha, canal y modo de entrega.
   */
  test("el alta mínima se guarda sin fecha, canal ni modo de entrega", async ({
    page,
  }) => {
    await login(page, geeko().owner);
    await page.goto("/orders/new");

    await elegirLinea(page, "Alfarería");
    await elegirCliente(page, "Colegio San Andrés");
    await agregarDelCatalogo(page, ["Maceta de barro"]);

    await page.getByTestId("save-order").click();
    await page.waitForURL(ORDER_DETAIL);

    // Los tres datos ausentes se muestran como tales, sin error.
    await expect(page.getByTestId("detail-channel")).toHaveText("—");
    await expect(page.getByTestId("detail-delivery")).toHaveText("—");
    await expect(page.getByTestId("detail-due-date")).toHaveText("—");
    await expect(page.getByTestId("order-total")).toHaveText("60.00");
    // Sin fecha comprometida no hay alerta de retraso.
    await expect(page.getByTestId("overdue-alert")).toHaveCount(0);

    // Y nace en el estado inicial del juego de su línea.
    await expect(page.getByTestId("status-select")).toContainText("Reservado");
  });

  test("guardar sin cliente o sin líneas se impide señalando el campo", async ({
    page,
  }) => {
    await login(page, geeko().owner);
    await page.goto("/orders/new");

    await elegirLinea(page, "Alfarería");
    await agregarDelCatalogo(page, ["Maceta de barro"]);

    await page.getByTestId("save-order").click();
    await expect(page.getByTestId("contact-error")).toContainText(
      "Elige o crea un cliente",
    );
    await expect(page).toHaveURL(/\/orders\/new$/);

    // Con cliente pero sin líneas, el mensaje señala las líneas.
    await elegirCliente(page, "Colegio San Andrés");
    await page.getByRole("button", { name: "Quitar Maceta de barro" }).click();
    await page.getByTestId("save-order").click();

    await expect(page.getByTestId("lines-error")).toContainText(
      "Agrega al menos una línea",
    );
    await expect(page).toHaveURL(/\/orders\/new$/);
  });

  /** Criterio 3: crear el cliente con nombre y teléfono sin salir del alta. */
  test("el cliente se crea al vuelo sin perder lo escrito", async ({ page }) => {
    await login(page, geeko().owner);
    await page.goto("/orders/new");

    await elegirLinea(page, "Alfarería");
    await agregarDelCatalogo(page, ["Maceta de barro"]);
    await page.getByLabel("Nota").fill("Entrega en la feria del sábado.");

    // Un nombre único por ejecución: las dos plataformas corren en paralelo.
    const nombre = `Clienta ${Date.now()}${Math.floor(Math.random() * 1000)}`;
    // Registrar lo buscado: el nombre llega prellenado desde el filtro.
    await registrarCliente(page, {
      nombre,
      telefono: "77712345",
      correo: "clienta@example.com",
      direccion: "Calle Sucre 45",
    });
    // Lo que ya estaba escrito sigue ahí.
    await expect(page.getByLabel("Nota")).toHaveValue(
      "Entrega en la feria del sábado.",
    );
    await expect(page.getByTestId("order-form-total")).toHaveText("60.00");

    await page.getByTestId("save-order").click();
    await page.waitForURL(ORDER_DETAIL);
    await expect(page.getByText(nombre)).toBeVisible();

    // El contacto quedó en el directorio, con su rol de cliente.
    await page.goto("/contacts");
    await page.getByRole("button", { name: nombre }).click();
    const detalle = page.getByTestId("contact-detail");
    await expect(detalle).toContainText("77712345");
    await expect(detalle).toContainText("clienta@example.com");
    await expect(detalle).toContainText("Calle Sucre 45");
    await expect(detalle).toContainText("Cliente");
  });

  /** Criterio 4: el formulario vuelve en blanco conservando línea y canal. */
  test("«Guardar y crear otro» conserva línea y canal, y limpia lo demás", async ({
    page,
  }) => {
    await login(page, geeko().owner);
    await page.goto("/orders/new");

    await elegirLinea(page, "Alfarería");
    await elegirCliente(page, "Colegio San Andrés");
    await agregarDelCatalogo(page, ["Maceta de barro"]);

    await page.getByTestId("channel-select").click();
    await page.getByRole("option", { name: "Feria", exact: true }).click();
    await page.getByLabel("Nota").fill("Primero de la tanda.");

    await page.getByTestId("save-and-new").click();

    // No navega: anuncia el número del pedido guardado y sigue aquí.
    await expect(page.getByTestId("order-form-notice")).toContainText("guardado");
    await expect(page).toHaveURL(/\/orders\/new$/);

    // Lo que no cambia entre dos pedidos sigue puesto…
    await expect(page.getByTestId("line-select")).toContainText("Alfarería");
    await expect(page.getByTestId("channel-select")).toContainText("Feria");

    // …y lo demás queda en blanco.
    await expect(page.getByText("Sin líneas todavía")).toBeVisible();
    await expect(disparadorCliente(page)).toHaveText("Seleccionar cliente");
    await expect(disparadorCliente(page)).toBeFocused();
    await expect(page.getByLabel("Nota")).toHaveValue("");
    await expect(page.getByTestId("order-form-total")).toHaveText("0.00");

    // Y el pedido guardado existe de verdad, en la columna inicial.
    await page.goto("/orders?view=list");
    await expect(page.getByTestId("order-row").first()).toBeVisible();
  });

  /** Regla de retorno del mapa de navegación §8. */
  test("salir con datos escritos pide confirmación antes de descartar", async ({
    page,
  }) => {
    await login(page, geeko().owner);
    await page.goto("/orders?view=list&q=Colegio");

    await page.getByTestId("new-order").click();
    await page.waitForURL(/\/orders\/new$/);

    await page.getByLabel("Nota").fill("Algo que no quiero perder.");
    await page.getByTestId("discard-button").click();

    // Rechazar la confirmación conserva lo escrito.
    await page.getByRole("button", { name: "Seguir editando" }).click();
    await expect(page.getByLabel("Nota")).toHaveValue(
      "Algo que no quiero perder.",
    );
    await expect(page).toHaveURL(/\/orders\/new$/);

    // Aceptarla vuelve a la lista, con su filtro intacto.
    await page.getByTestId("discard-button").click();
    await page.getByTestId("confirm-discard").click();
    await expect(page).toHaveURL(/view=list/);
    await expect(page).toHaveURL(/q=Colegio/);
  });

  test("sin cambios, cancelar sale sin preguntar", async ({ page }) => {
    await login(page, geeko().owner);
    await page.goto("/orders?view=list");

    await page.getByTestId("new-order").click();
    await page.waitForURL(/\/orders\/new$/);

    await page.getByTestId("discard-button").click();

    await expect(page.getByText("¿Descartar los cambios?")).toHaveCount(0);
    await expect(page).toHaveURL(/view=list/);
  });

  /**
   * Formato "pantalla completa móvil" del mapa de navegación §2.3: la barra
   * inferior estorba en un formulario de captura, y guardar tiene que estar
   * al alcance sin desplazarse.
   */
  test("en el celular el formulario es pantalla completa", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "solo aplica al formato móvil");

    await login(page, geeko().owner);

    await page.goto("/orders");
    await expect(page.getByTestId("bottom-bar")).toBeVisible();

    await page.goto("/orders/new");
    await expect(page.getByTestId("bottom-bar")).toHaveCount(0);
    await expect(page.getByTestId("save-order")).toBeInViewport();
    await expect(page.getByTestId("discard-button")).toBeInViewport();

    // El diálogo de catálogo cabe en la pantalla: con la lista completa
    // abierta, el pie sigue a la vista sin desplazar la página.
    await page.getByRole("button", { name: "Agregar del catálogo" }).click();
    const catalogo = page.getByRole("dialog", { name: "Agregar del catálogo" });
    await expect(catalogo.getByRole("option").first()).toBeVisible();
    await expect(catalogo.getByRole("button", { name: "Agregar" })).toBeInViewport();
    await expect(catalogo.getByRole("button", { name: "Cancelar" })).toBeInViewport();
  });
});
