import { expect, test, type Page } from "@playwright/test";

// Usuarios de supabase/seed.sql (contraseña común de desarrollo).
const PASSWORD = "kamay123";
const GEEKO_OWNER = "geeko@kamay.test";
// Organización con doce meses de movimientos: es la que da materia a los
// informes y la que mide el presupuesto del criterio 8.
const HISTORY_OWNER = "historico@kamay.test";

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|quick)$/);
}

test.describe("V14 · Reportes", () => {
  // La disposición de escritorio: los cinco informes apilados. La variante
  // estrecha tiene su propio bloque abajo.
  test.skip(({ isMobile }) => Boolean(isMobile), "solo en escritorio");

  test("la dueña entra por dirección directa y ve los cinco informes", async ({
    page,
  }) => {
    await login(page, HISTORY_OWNER);
    await page.goto("/reports");

    await expect(
      page.getByRole("heading", { name: "Reportes", level: 2 }),
    ).toBeVisible();

    for (const title of [
      "Rentabilidad",
      "En qué se va el dinero",
      "Qué se vende más",
      "Insumos por acabarse",
      "Comparativo entre líneas",
    ]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });

  test("el enlace reproduce el recorte que se compartió", async ({ page }) => {
    await login(page, HISTORY_OWNER);

    const url = "/reports?preset=custom&from=2026-01-12&to=2026-02-20";
    await page.goto(url);

    // El periodo compartido se conserva; no vuelve al mes en curso.
    await expect(page.getByText("Del 2026-01-12 al 2026-02-20")).toBeVisible();
    await expect(page.getByLabel("Periodo")).toContainText("Rango libre");
  });

  test("cambiar el periodo recalcula y queda en la dirección", async ({
    page,
  }) => {
    await login(page, HISTORY_OWNER);
    await page.goto("/reports");

    await page.getByLabel("Periodo").click();
    await page.getByRole("option", { name: "Mes anterior" }).click();

    await expect(page).toHaveURL(/preset=last-month/);
  });

  test("un rango invertido se rechaza y no recalcula", async ({ page }) => {
    await login(page, HISTORY_OWNER);
    await page.goto("/reports?preset=custom&from=2026-04-20&to=2026-03-12");

    await expect(
      page.getByText(/El fin del periodo es anterior a su inicio/),
    ).toBeVisible();
  });

  test("el comparativo lleva su leyenda de reparto y avisa de que no se filtra", async ({
    page,
  }) => {
    await login(page, HISTORY_OWNER);
    await page.goto("/reports");

    await expect(page.getByTestId("allocation-legend")).toBeVisible();
    await expect(
      page.getByText("Este informe muestra siempre todas las líneas"),
    ).toBeVisible();
  });

  test("insumos por acabarse dice que muestra el saldo de hoy, sin leyenda de reparto", async ({
    page,
  }) => {
    await login(page, GEEKO_OWNER);
    await page.goto("/reports");

    const section = page.getByRole("region", { name: "Insumos por acabarse" });
    await expect(
      section.getByText("Muestra el saldo de hoy"),
    ).toBeVisible();
    // Un informe que no reparte no lleva leyenda: una leyenda donde no hubo
    // reparto es tan engañosa como su ausencia donde sí lo hubo.
    await expect(section.getByTestId("allocation-legend")).toHaveCount(0);
  });

  test("el ranking se ordena por unidades y por margen sin perder columnas", async ({
    page,
  }) => {
    await login(page, HISTORY_OWNER);
    // Un periodo con ventas: el mes en curso tiene cobros de pedidos
    // anteriores, que es otra cosa (los informes de dinero miden en caja).
    await page.goto("/reports?preset=this-year");

    const section = page.getByRole("region", { name: "Qué se vende más" });
    await expect(section.getByRole("button", { name: "Unidades" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await section.getByRole("button", { name: "Margen" }).click();

    await expect(section.getByRole("button", { name: "Margen" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Las dos columnas siguen presentes: es el punto entero del informe.
    await expect(section.getByRole("columnheader", { name: "Unidades" })).toBeVisible();
    await expect(section.getByRole("columnheader", { name: "Margen" })).toBeVisible();
  });

  test("la exportación descarga lo que se ve, con su contexto", async ({
    page,
  }) => {
    await login(page, HISTORY_OWNER);
    await page.goto("/reports");

    const section = page.getByRole("region", { name: "Comparativo entre líneas" });
    const download = page.waitForEvent("download");
    await section.getByRole("link", { name: "Exportar" }).click();
    const file = await download;

    expect(file.suggestedFilename()).toMatch(/^informe-line-comparison-.*\.csv$/);

    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    // El archivo se explica solo: periodo, línea y leyenda de reparto.
    expect(csv).toContain("Comparativo entre líneas");
    expect(csv).toContain("Periodo,");
    expect(csv).toContain("Línea,");
    expect(csv).toContain("Reparto,");
  });

  test("una fila de rentabilidad abre su pedido", async ({ page }) => {
    await login(page, HISTORY_OWNER);
    await page.goto("/reports?preset=this-year");

    const section = page.getByRole("region", { name: "Rentabilidad" });
    const link = section.getByRole("table").getByRole("link").first();
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  });

  test("una fila de egresos abre la bandeja filtrada por el mismo periodo", async ({
    page,
  }) => {
    await login(page, HISTORY_OWNER);
    await page.goto("/reports?preset=this-year");

    const section = page.getByRole("region", { name: "En qué se va el dinero" });
    await section.getByRole("table").getByRole("link").first().click();

    await expect(page).toHaveURL(/\/expenses\?.*from=\d{4}-\d{2}-\d{2}/);
  });

  test("el informe responde en menos de 3 segundos con doce meses", async ({
    page,
  }) => {
    await login(page, HISTORY_OWNER);

    const started = Date.now();
    await page.goto("/reports?preset=this-year");
    // Medido sobre la carga completa, no sobre una pintura parcial: se espera
    // a que el último de los cinco informes tenga sus cifras.
    await expect(page.getByTestId("allocation-legend")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Insumos por acabarse" }),
    ).toBeVisible();
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(3000);
  });
});

test.describe("V14 · en pantalla estrecha", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("se ve un informe por vez, con su conmutador", async ({ page }) => {
    await login(page, HISTORY_OWNER);
    await page.goto("/reports");

    const tabs = page.getByRole("tablist", { name: "Informes" });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole("tab")).toHaveCount(5);

    // El comparativo es el que se muestra al abrir.
    await expect(
      page.getByRole("region", { name: "Comparativo entre líneas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Rentabilidad" }),
    ).toBeHidden();

    await tabs.getByRole("tab", { name: "Rentabilidad" }).click();

    await expect(
      page.getByRole("region", { name: "Rentabilidad" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Comparativo entre líneas" }),
    ).toBeHidden();
  });
});
