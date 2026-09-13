import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // KAM-23 · Una suite estable no espera por tiempo fijo: cada espera se
    // ancla a algo observable (`expect(...)`, `waitForURL`, `expect.poll`).
    // Un `waitForTimeout` aprueba en la máquina rápida y falla en la lenta, o
    // al revés, y es la primera fuente de pruebas intermitentes.
    files: ["tests/e2e/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message:
            "Nada de esperas por tiempo fijo: espera a un estado observable (expect, waitForURL, expect.poll).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Documentación, especificaciones y salidas generadas — no son código de la aplicación.
    "specs/**",
    "openspec/**",
    "graphify-out/**",
    "supabase/**",
    "playwright-report/**",
    "test-results/**",
    // Worktrees de otras sesiones (excluidos de git en .git/info/exclude):
    // son copias de otras ramas, no código de esta.
    ".claude/**",
    // El service worker lo compila Serwist en el paso `postbuild`; el fuente
    // que sí se revisa es `app/sw.ts`.
    "public/sw.js",
    "public/sw.js.map",
  ]),
]);

export default eslintConfig;
