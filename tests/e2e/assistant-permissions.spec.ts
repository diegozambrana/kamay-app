import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";
const GEEKO_ASSISTANT = "ayudante@kamay.test";
// Organización aparte con doce meses de movimientos (supabase/seed.sql): los
// datos que el presupuesto de carga necesita no viven en Geeko Store, cuyas
// filas son fixtures de las suites de tablero, alta y feria.
const HISTORY_OWNER = "historico@kamay.test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

/** Cualquier cifra con dos decimales: un importe, en esta interfaz. */
const MONEY = /\d+\.\d{2}/;

test.describe("V2 · panel del ayudante", () => {
  test("no hay un solo monto en su pantalla", async ({ page }) => {
    await login(page, GEEKO_ASSISTANT);
    await page.goto("/dashboard");

    await expect(page.getByTestId("assistant-dashboard")).toBeVisible();

    // La semilla tiene doce meses de cobros, pagos y pedidos con saldo: si
    // algo de dinero se colara, aquí habría materia de sobra para que
    // apareciera.
    const text = (await page.getByTestId("assistant-dashboard").innerText()) ?? "";
    expect(text).not.toMatch(MONEY);
    expect(text).not.toMatch(/Ingresos|Egresos|Margen|Por cobrar/);
  });

  test("recibe su propia composición, no la del dueño con huecos", async ({
    page,
  }) => {
    await login(page, GEEKO_ASSISTANT);
    await page.goto("/dashboard");

    // Las piezas del dueño no existen en su árbol: ni vacías ni ocultas.
    await expect(page.getByTestId("owner-dashboard")).toHaveCount(0);
    await expect(page.getByTestId("indicator-cards")).toHaveCount(0);
    await expect(page.getByTestId("line-comparison")).toHaveCount(0);
    await expect(page.getByTestId("recent-activity")).toHaveCount(0);

    // Y lo que sí tiene, tiene contenido.
    await expect(page.getByTestId("upcoming-deliveries")).toBeVisible();
    // Pendientes dejó de ser marcador con KAM-17 e insumos bajo mínimo con
    // KAM-18: el ayudante ve las dos tarjetas con su contenido real.
    await expect(page.getByTestId("pending-tasks-card")).toBeVisible();
    await expect(page.getByTestId("low-stock-card")).toBeVisible();
  });

  test("la composición llega ya decidida desde el servidor", async ({ page }) => {
    await login(page, GEEKO_ASSISTANT);

    // Sin JavaScript no hay forma de retirar nada después: lo que llega en el
    // HTML es lo definitivo. Si el recorte se hiciera al hidratar, las piezas
    // del dueño estarían en esta respuesta.
    const response = await page.goto("/dashboard");
    const html = (await response?.text()) ?? "";

    expect(html).toContain("assistant-dashboard");
    expect(html).not.toContain("indicator-cards");
    expect(html).not.toContain("line-comparison");
  });

  test("la campana está también para el ayudante", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "la barra superior es de escritorio");

    await login(page, GEEKO_ASSISTANT);
    await page.goto("/dashboard");

    await expect(page.getByTestId("notification-bell")).toBeVisible();
    await expect(page.getByTestId("notification-badge")).toHaveCount(0);
  });
});

test.describe("V2 · panel de la persona dueña", () => {
  test("muestra las cuatro cifras y el comparativo de todas las líneas", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    await expect(page.getByTestId("owner-dashboard")).toBeVisible();

    for (const id of [
      "indicator-income",
      "indicator-expenses",
      "indicator-margin",
      "indicator-receivable",
    ]) {
      await expect(page.getByTestId(`${id}-amount`)).toHaveText(MONEY);
    }

    // Una fila por línea activa. No se afirma un número exacto: otras suites
    // crean y archivan líneas en esta misma organización sembrada, y el
    // recuento variaría según qué corra a la vez. Lo que sí es invariante es
    // que las líneas de la semilla estén todas, incluida General —que no
    // tiene ingresos y aun así no desaparece de la comparación—.
    const comparison = page.getByTestId("line-comparison");
    for (const line of ["Sublimación", "Impresión 3D", "Alfarería", "General"]) {
      await expect(comparison.getByRole("rowheader", { name: line })).toBeVisible();
    }
  });

  test("Por cobrar ignora el periodo: cuenta saldos de meses anteriores", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    // La semilla deja saldos vivos de pedidos anteriores al mes en curso. Si
    // Por cobrar se recortara al mes, esta cifra sería cero.
    const receivable = await page
      .getByTestId("indicator-receivable-amount")
      .innerText();

    expect(Number(receivable)).toBeGreaterThan(0);
  });

  test("cambiar de línea recalcula todo el panel", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "el selector de línea vive en la tira de contexto");

    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    const income = page.getByTestId("indicator-income-amount");
    const todas = await income.innerText();

    await page.getByTestId("line-selector").click();
    await page.getByRole("menuitem", { name: "Alfarería" }).click();
    await expect(page.getByTestId("line-selector")).toContainText("Alfarería");
    await expect(page.getByTestId("line-selector")).toBeEnabled();

    // Una sola línea no puede sumar lo mismo que las tres, salvo que el
    // selector no esté llegando a la consulta.
    await expect(income).not.toHaveText(todas);

    // Y el comparativo sigue mostrando las demás: recortar el indicador no es
    // recortar la comparación.
    const comparison = page.getByTestId("line-comparison");
    await expect(
      comparison.getByRole("rowheader", { name: "Sublimación" }),
    ).toBeVisible();
    await expect(
      comparison.getByRole("rowheader", { name: "Alfarería" }),
    ).toBeVisible();
  });

  test("los últimos movimientos se leen como frases", async ({ page }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    const activity = page.getByTestId("recent-activity");
    await expect(activity).toBeVisible();

    const text = await activity.innerText();
    // Ni nombres de tabla ni de columna: la bitácora se lee en lenguaje
    // natural (§11).
    expect(text).not.toMatch(/order_items|status_changed|business_line_id/);
  });

  test("las entregas próximas no traen pedidos ya entregados", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    const deliveries = page.getByTestId("upcoming-deliveries");
    await expect(deliveries).toBeVisible();

    // La semilla tiene doce meses de pedidos entregados con fecha pasada. Sin
    // el recorte por estado serían los primeros de la lista y desplazarían a
    // los que siguen comprometidos.
    const links = deliveries.getByRole("link");
    const count = await links.count();
    for (let i = 0; i < count; i += 1) {
      await expect(links.nth(i)).not.toContainText("Entregado");
    }
  });

  test("carga en menos de 1,5 s con doce meses sembrados", async ({
    page,
    isMobile,
  }) => {
    // Una sola medición, en la superficie de la que V2 es la puerta de
    // entrada. Medirla también en el proyecto móvil no añadiría nada sobre la
    // pantalla y sí ruido: los dos proyectos corren a la vez contra el mismo
    // servidor, y el segundo mediría la contención, no el panel.
    test.skip(Boolean(isMobile), "el presupuesto se mide en escritorio");

    await login(page, HISTORY_OWNER);

    // Doce meses de pedidos, egresos y movimientos (KAM-14, criterio 6). Se
    // mide la carga de la ruta hasta que la pantalla está realmente
    // compuesta —la última pieza rendida—, no una pintura parcial.
    const started = Date.now();
    await page.goto("/dashboard");
    await expect(page.getByTestId("owner-dashboard")).toBeVisible();
    await expect(page.getByTestId("recent-activity")).toBeVisible();
    await expect(page.getByTestId("indicator-income-amount")).toHaveText(MONEY);
    const elapsed = Date.now() - started;

    expect(elapsed, `el panel tardó ${elapsed} ms`).toBeLessThan(1500);
  });

  // Scenario "Ningún marcador de posición sobrevive" (delta spec `dashboard`)
  test("al panel no le queda ningún marcador de posición", async ({ page }) => {
    // KAM-17 retiró el de pendientes y KAM-18 el de insumos: las dos piezas
    // muestran contenido real y llevan a su pantalla.
    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    await expect(page.getByTestId("low-stock-card")).toContainText(
      "Insumos bajo mínimo",
    );
    await expect(page.getByTestId("pending-tasks-card")).toContainText(
      "Pendientes",
    );

    await expect(page.locator("[data-placeholder]")).toHaveCount(0);
    await expect(page.getByTestId("placeholder-stock")).toHaveCount(0);
    await expect(page.getByTestId("placeholder-tasks")).toHaveCount(0);
  });

  test("la campana abre la bandeja", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "la barra superior es de escritorio");

    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    // La campana es un componente de cliente: pulsarla antes de que hidrate
    // no abre nada. Es la misma espera que el selector de línea necesita en
    // las demás suites.
    const bell = page.getByTestId("notification-bell");
    await expect(bell).toBeEnabled();
    await bell.click();

    // Desde KAM-17 la bandeja existe: sin avisos muestra su lista vacía, y
    // siempre ofrece el camino a las preferencias (mapa §11).
    await expect(page.getByTestId("notification-panel")).toContainText(
      "Preferencias de notificación",
      { timeout: 10_000 },
    );
    // No navega: la ruta no existe.
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("V2 · el panel en un teléfono", () => {
  test.skip(({ isMobile }) => !isMobile, "solo en el proyecto móvil");

  test("se apila en una columna y no desplaza horizontalmente", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    await expect(page.getByTestId("owner-dashboard")).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("entrar desde el teléfono sigue aterrizando en el registro rápido", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    // El panel es alcanzable desde "Más", pero la puerta de entrada del
    // celular sigue siendo V16 (mapa §4.2).
    await expect(page).toHaveURL(/\/quick$/);
  });
});

test.describe("V2 · el botón + Registrar de escritorio", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "aquí se prueba la superficie de escritorio");

  test("registrar una compra desde el panel son dos interacciones", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/dashboard");

    const button = page.getByTestId("register-button");
    await expect(button).toBeEnabled();
    await button.click();

    const purchase = page.getByTestId("register-destination-purchase");
    await expect(purchase).toBeVisible();
    await purchase.click();

    await page.waitForURL(/\/expenses\/purchases\/new$/);
  });

  test("el flotante no tapa controles del panel ni del tablero", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    for (const route of ["/dashboard", "/orders"]) {
      await page.goto(route);
      await expect(page.getByTestId("register-button")).toBeVisible();

      // Hasta el final de la página: es ahí donde el flotante puede atrapar
      // la última fila, que es el fallo que el `pb` del contenedor evita.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      const trapped = await page.evaluate(() => {
        const fab = document.querySelector(
          "[data-testid='register-button']",
        ) as HTMLElement | null;
        const main = document.querySelector("main");
        if (!fab || !main) return ["sin flotante o sin main"];

        const box = fab.getBoundingClientRect();

        return [...main.querySelectorAll("a, button, input, select")]
          .filter((element) => {
            // El propio flotante vive dentro del contenedor —`SidebarInset`
            // se rinde como `<main>`—, así que se solapa consigo mismo.
            if (element === fab || fab.contains(element)) return false;
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            return !(
              rect.right < box.left ||
              rect.left > box.right ||
              rect.bottom < box.top ||
              rect.top > box.bottom
            );
          })
          .map(
            (element) =>
              `${element.tagName.toLowerCase()}` +
              `[${element.getAttribute("data-testid") ?? ""}] ` +
              `${element.textContent?.trim().slice(0, 40) ?? ""}`,
          );
      });

      expect(trapped, `controles bajo el flotante en ${route}`).toEqual([]);
    }
  });
});

/**
 * KAM-15 · El ayudante ve solo las tareas de su línea o las asignadas a él.
 *
 * Escenarios del delta spec `tasks` — requisito "Visibilidad de tareas por rol
 * y por línea": «Ayudante restringido a una línea» y «Tarea asignada de otra
 * línea». Y del delta spec `user-management` — «Owner restricts an assistant to
 * one line».
 *
 * El recorte lo aplica RLS, así que la comprobación importante es que **no se
 * pueda esquivar manipulando la dirección**: filtrar por la línea prohibida
 * sigue sin devolver nada.
 */
test.describe.serial("tareas del ayudante por línea", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "usa el selector de línea del menú lateral");

  const enAlfareria = `Alfarería ${Date.now()}`;
  const enSublimacion = `Sublimación ${Date.now()}`;

  test("el dueño crea una tarea en cada línea y restringe al ayudante", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);

    for (const [linea, titulo] of [
      ["Alfarería", enAlfareria],
      ["Sublimación", enSublimacion],
    ] as const) {
      await page.getByTestId("line-selector").click();
      await page.getByRole("menuitem", { name: linea }).click();
      await expect(page.getByTestId("line-selector")).toBeEnabled();

      await page.goto("/tasks");
      await page.getByTestId("quick-add-task").click();
      await page.getByTestId("quick-add-title").fill(titulo);
      await page.getByTestId("quick-add-title").press("Enter");
      await expect(page.getByText(titulo)).toBeVisible();
    }

    // Se restringe al ayudante a Alfarería desde Usuarios y roles.
    await page.goto("/settings/members");
    const fila = page
      .getByTestId("member-list")
      .locator("li")
      .filter({ hasText: "Ayudante Geeko" });
    // La casilla se deshabilita mientras la acción viaja, así que se pulsa y se
    // espera la respuesta: `check()` verificaría sobre un control deshabilitado.
    const guardado = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/settings/members"),
    );
    await fila.getByLabel(/^Alfarería para/).click();
    await guardado;
    await expect(fila.getByLabel(/^Alfarería para/)).toBeChecked();
  });

  test("el ayudante ve su línea y no la que no le toca", async ({ page }) => {
    await login(page, GEEKO_ASSISTANT);

    // La lista cruza todas las líneas, así que muestra todo lo que puede ver.
    await page.goto("/tasks?view=list");

    await expect(page.getByText(enAlfareria)).toBeVisible();
    await expect(page.getByText(enSublimacion)).toHaveCount(0);
  });

  test("manipular la dirección no le devuelve lo que RLS le quitó", async ({
    page,
  }) => {
    await login(page, GEEKO_ASSISTANT);

    // Filtrar explícitamente por el título de la tarea prohibida: si el recorte
    // viviera en la interfaz y no en la base, aquí aparecería.
    await page.goto(`/tasks?view=list&q=${encodeURIComponent(enSublimacion)}`);

    await expect(page.getByTestId("task-row")).toHaveCount(0);
    await expect(page.getByText(enSublimacion)).toHaveCount(0);
  });

  test("el dueño le devuelve todas las líneas y vuelve a verlo todo", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/settings/members");

    const fila = page
      .getByTestId("member-list")
      .locator("li")
      .filter({ hasText: "Ayudante Geeko" });
    const guardado = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/settings/members"),
    );
    await fila.getByLabel(/^Alfarería para/).click();
    await guardado;
    await expect(fila.getByLabel(/^Alfarería para/)).not.toBeChecked();
  });
});
