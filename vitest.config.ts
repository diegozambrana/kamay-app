import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` es una guardia **del empaquetador**: su trabajo es que
      // una importación desde el bundle de cliente rompa la compilación. El
      // corredor de pruebas no es el empaquetador, y en jsdom el paquete se
      // limita a lanzar al cargarse, lo que dejaría sin probar justamente los
      // módulos más delicados —el generador de notificaciones, que es el único
      // punto del sistema que escribe con service role—.
      //
      // Neutralizarlo aquí no debilita nada en producción: la guardia real
      // sigue en `next build`, y una prueba de arquitectura comprueba además
      // que `lib/supabase/admin.ts` no se importa desde `features/`.
      "server-only": new URL("./tests/setup/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/setup/unit.ts"],
          include: [
            "{app,actions,services,features,components,lib,hooks,stores,types,constants,configs}/**/*.test.{ts,tsx}",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
        },
      },
    ],
  },
});
