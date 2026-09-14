/**
 * Regenera las capturas de `docs/capturas/` para los manuales.
 *
 * Requiere Supabase local con la semilla (`supabase db reset`) y el servidor
 * de desarrollo en el puerto 3010 (`npm run dev`).
 *
 *   node scripts/docs-capturas.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
const BASE = "http://localhost:3010";
const OUT = new URL("../docs/capturas/", import.meta.url).pathname;
const IDS = { order: "a0000000-0000-0000-0000-000000000001", task: "51b2307d-eb4a-45c7-b630-f2cbe97c12c7", item: "90000000-0000-0000-0000-000000000001", expense: "b0000000-0000-0000-0000-000000000002", cost: "b0000000-0000-0000-0000-000000000005" };
const HIDE = "nextjs-portal{display:none!important}";
async function ctxOf(browser, opts) {
  const ctx = await browser.newContext({ colorScheme: "light", locale: "es", ...opts });
  await ctx.addInitScript((css) => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }); }, HIDE);
  return ctx;
}
async function login(page, email) {
  await page.goto(`${BASE}/auth/login`);
  await page.getByPlaceholder("tu@correo.com").fill(email);
  await page.locator('input[type="password"]').fill("kamay123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 20000 });
}
async function shot(page, name, full = true) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log("✔", name);
}
async function go(page, route, name, full = true) { await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }); await shot(page, name, full); }
async function step(name, fn) { try { await fn(); } catch (e) { console.log("✘", name, e.message.split("\n")[0]); } }
const browser = await chromium.launch();

// Escritorio · dueña
{
  const ctx = await ctxOf(browser, { viewport: { width: 1280, height: 820 } });
  const page = await ctx.newPage();
  await go(page, "/auth/login", "auth-login");
  await go(page, "/auth/forgot-password", "auth-forgot-password");
  await go(page, "/auth/reset-password", "auth-reset-password-sin-enlace");
  await go(page, "/auth/invite/token-invalido", "auth-invite-invalido");
  await login(page, "geeko@kamay.test");
  await go(page, "/fair", "feria-abrir", false); // con la línea en «Todas» se ve el paso de apertura
  // Con «Todas» las líneas
  await go(page, "/dashboard", "panel");
  await go(page, "/orders", "pedidos-tablero-sin-linea", false);
  await go(page, "/tasks", "tareas-tablero-sin-linea", false);
  await go(page, "/settings/statuses", "config-estados");
  await step("selector-linea", async () => {
    await page.goto(`${BASE}/dashboard`); await page.waitForLoadState("networkidle").catch(()=>{});
    await page.getByRole("button", { name: "Línea de negocio" }).click(); await shot(page, "selector-linea", false);
    await page.getByRole("menuitem", { name: /Sublimación/ }).click(); await shot(page, "panel-linea-sublimacion");
  });
  await step("registrar-menu", async () => { await page.getByRole("button", { name: "Registrar" }).click(); await shot(page, "boton-registrar-menu", false); await page.keyboard.press("Escape"); });
  await step("notificaciones", async () => { await page.getByRole("button", { name: /Notificaciones/ }).click(); await shot(page, "panel-notificaciones", false); await page.keyboard.press("Escape"); });
  await go(page, "/quick", "registrar");
  await step("quick-consumo", async () => { await page.getByText("Consumo", { exact: true }).click(); await shot(page, "registrar-consumo", false); await page.keyboard.press("Escape"); });
  await go(page, "/orders", "pedidos-tablero", false);
  await step("pedidos-vistas", async () => {
    await page.getByRole("radio", { name: "Lista" }).click(); await shot(page, "pedidos-lista");
    await page.getByRole("radio", { name: "Calendario" }).click(); await shot(page, "pedidos-calendario");
  });
  await go(page, "/orders/new", "pedidos-nuevo");
  await go(page, `/orders/${IDS.order}`, "pedidos-detalle");
  await step("pedido-dialogos", async () => {
    await page.getByRole("button", { name: "Registrar cobro" }).click(); await shot(page, "pedidos-registrar-cobro", false); await page.keyboard.press("Escape");
    await page.getByRole("combobox", { name: "Estado" }).click(); await shot(page, "pedidos-cambiar-estado", false); await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Cancelar pedido" }).click(); await shot(page, "pedidos-cancelar-dialogo", false); await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ver cambio" }).first().click(); await page.waitForTimeout(400); await shot(page, "pedidos-historial-ver-cambio");
  });
  await go(page, `/orders/${IDS.order}/edit`, "pedidos-editar");
  await go(page, "/tasks", "tareas-tablero", false);
  await step("tareas-vistas", async () => {
    await page.getByRole("radio", { name: "Lista" }).click(); await shot(page, "tareas-lista");
    await page.getByRole("radio", { name: "Calendario" }).click(); await shot(page, "tareas-calendario");
  });
  await step("tareas-alta-rapida", async () => {
    await page.goto(`${BASE}/tasks`); await page.waitForLoadState("networkidle").catch(()=>{});
    await page.locator('[data-testid="quick-add-task"]').click(); await shot(page, "tareas-alta-rapida", false); await page.keyboard.press("Escape");
  });
  await go(page, "/tasks/new", "tareas-nueva");
  await go(page, `/tasks/new?orderId=${IDS.order}`, "tareas-nueva-desde-pedido");
  await go(page, `/tasks/${IDS.task}`, "tareas-detalle");
  await go(page, "/my-tasks", "mis-pendientes");
  await go(page, "/expenses", "egresos-lista");
  await go(page, `/expenses/${IDS.expense}`, "egresos-detalle-compra");
  await go(page, `/expenses/${IDS.cost}`, "egresos-detalle-costo");
  await go(page, "/expenses/purchases/new", "egresos-nueva-compra");
  await go(page, "/expenses/costs/new", "egresos-nuevo-costo");
  await go(page, "/catalog", "catalogo-lista");
  await step("catalogo-nuevo", async () => { await page.getByRole("button", { name: /Nuevo ítem/ }).click(); await shot(page, "catalogo-nuevo-item", false); await page.keyboard.press("Escape"); });
  await go(page, `/catalog/${IDS.item}`, "catalogo-detalle");
  await step("inventario-dialogos", async () => {
    await page.goto(`${BASE}/catalog/90000000-0000-0000-0000-000000000002`); await page.waitForLoadState("networkidle").catch(()=>{});
    await shot(page, "catalogo-detalle-insumo");
    await page.getByRole("button", { name: "Registrar consumo" }).click(); await shot(page, "inventario-registrar-consumo", false); await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ajuste por conteo" }).click(); await shot(page, "inventario-ajuste-conteo", false); await page.keyboard.press("Escape");
  });
  await go(page, "/contacts", "contactos");
  await step("contactos-detalle", async () => {
    await page.getByText("María Céspedes").first().click(); await shot(page, "contactos-detalle");
    await page.getByRole("button", { name: /Nuevo contacto/ }).click(); await shot(page, "contactos-nuevo", false); await page.keyboard.press("Escape");
  });
  await go(page, "/assets", "activos");
  await step("activos-detalle", async () => { const c = page.locator("main a, main button").filter({ hasText: /%/ }).first(); if (await c.count()) { await c.click(); await shot(page, "activos-detalle"); } });
  await go(page, "/reports", "informes");
  await go(page, "/activity", "bitacora");
  await go(page, "/settings/general", "config-general");
  await go(page, "/settings/lines", "config-lineas");
  await go(page, "/settings/statuses?flow=order&line=30000000-0000-0000-0000-000000000001", "config-estados-linea");
  await step("config-estados-editar", async () => { await page.getByRole("button", { name: "Editar" }).first().click(); await shot(page, "config-estados-editar"); });
  await go(page, "/settings/statuses?flow=task&line=org", "config-estados-tareas");
  await go(page, "/settings/categories", "config-categorias");
  await go(page, "/settings/units", "config-unidades");
  await go(page, "/settings/channels", "config-canales");
  await go(page, "/settings/members", "config-equipo");
  await go(page, "/settings/notifications", "config-notificaciones");
  await go(page, "/settings/retention", "config-retencion");
  await go(page, "/settings/export", "config-exportar");
  await step("feria", async () => {
    await page.goto(`${BASE}/fair`); await page.waitForLoadState("networkidle").catch(()=>{});
    const start = page.getByRole("button", { name: "Empezar a vender" });
    if (await start.count()) { await shot(page, "feria-abrir", false); await start.click(); }
    await shot(page, "feria-vendiendo", false);
    const taza = page.locator('[data-testid="fair-product"]').filter({ hasText: /Taza personalizada/ }).first(); await taza.click(); await taza.click();
    await page.locator('[data-testid="fair-product"]').filter({ hasText: /Bolsa de regalo/ }).first().click(); await shot(page, "feria-con-carrito", false);
    await page.locator('[data-testid="fair-checkout"]').click(); await shot(page, "feria-cobrar", false);
  });
  await go(page, "/offline", "sin-conexion", false);
  await go(page, "/ruta-inexistente", "no-encontrado", false);
  await step("tema-oscuro", async () => {
    await page.goto(`${BASE}/dashboard`); await page.waitForLoadState("networkidle").catch(()=>{});
    await page.getByRole("button", { name: "Cambiar tema" }).click(); await page.waitForTimeout(500); await shot(page, "panel-tema-oscuro", false);
    await page.getByRole("button", { name: "Cambiar tema" }).click();
  });
  await step("menu-plegado", async () => { await page.goto(`${BASE}/dashboard`); await page.locator('[data-sidebar="trigger"]').first().click(); await shot(page, "menu-plegado", false); });
  await ctx.close();
}
// Escritorio · ayudante
{
  const ctx = await ctxOf(browser, { viewport: { width: 1280, height: 820 } });
  const page = await ctx.newPage();
  await login(page, "ayudante@kamay.test");
  await go(page, "/dashboard", "ayudante-panel");
  await go(page, "/quick", "ayudante-registrar");
  await go(page, "/settings", "ayudante-config");
  await go(page, `/orders/${IDS.order}`, "ayudante-pedido-detalle");
  await ctx.close();
}
// Multi-organización
{
  const ctx = await ctxOf(browser, { viewport: { width: 1280, height: 820 } });
  const page = await ctx.newPage();
  await login(page, "multi@kamay.test"); await shot(page, "auth-seleccionar-organizacion");
  await ctx.close();
}
// Móvil
{
  const ctx = await ctxOf(browser, { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await login(page, "geeko@kamay.test");
  await shot(page, "movil-aterrizaje-registrar", false);
  await go(page, "/dashboard", "movil-panel", false);
  await go(page, "/orders", "movil-pedidos", false);
  await go(page, "/tasks", "movil-tareas", false);
  await go(page, "/my-tasks", "movil-mis-pendientes", false);
  await step("movil-mas", async () => { await page.locator('[data-testid="bottom-bar-more"]').click(); await shot(page, "movil-menu-mas", false); await page.keyboard.press("Escape"); });
  await step("movil-feria", async () => {
    await page.goto(`${BASE}/fair`); await page.waitForLoadState("networkidle").catch(()=>{});
    const start = page.getByRole("button", { name: "Empezar a vender" }); if (await start.count()) await start.click();
    await shot(page, "movil-feria", false);
    const taza = page.locator('[data-testid="fair-product"]').filter({ hasText: /Taza personalizada/ }).first(); await taza.click(); await taza.click(); await shot(page, "movil-feria-con-carrito", false); await page.locator('[data-testid="fair-checkout"]').click(); await shot(page, "movil-feria-cobrar", false);
  });
  await go(page, "/orders/new", "movil-pedido-nuevo", false);
  await go(page, "/reports", "movil-informes", false);
  await ctx.close();
}
await browser.close();
