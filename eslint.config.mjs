import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
  ]),
]);

export default eslintConfig;
