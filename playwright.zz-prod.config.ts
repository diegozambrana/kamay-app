import base from "./playwright.config";
import { defineConfig } from "@playwright/test";
// Temporal (KAM-23): la suite contra la compilación de producción en 3020.
export default defineConfig({
  ...base,
  retries: 0,
  use: { ...base.use, baseURL: "http://localhost:3020" },
  webServer: { command: "npx next start -p 3020", url: "http://localhost:3020", reuseExistingServer: false, timeout: 120_000 },
});
