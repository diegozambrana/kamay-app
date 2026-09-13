import { defineConfig, devices } from "@playwright/test";

const PORT = 3010;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /deployment\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /deployment\.spec\.ts/,
    },
    {
      // Simula un despliegue cambiando `public/sw.js` en disco, así que no
      // puede correr junto a las demás: ninguna otra prueba debe ver cambiar su
      // service worker a mitad de camino (KAM-23). Solo corre con
      // `E2E_DEPLOYMENT=1`, en su propio paso de CI después de la suite. No se
      // declara como dependiente de `desktop` y `mobile`: Playwright no repite
      // (`--repeat-each`) los proyectos de los que otro depende, y el trabajo
      // de estabilidad se habría quedado repitiendo solo esta prueba.
      name: "deployment",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /deployment\.spec\.ts/,
    },
  ],
  webServer: {
    // En CI se ejecuta tras `next build`; en local levanta el servidor de desarrollo.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
