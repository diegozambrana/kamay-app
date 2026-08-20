import { execSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import ws from "ws";

// Resuelve las credenciales del entorno local en tiempo de ejecución
// (vía `supabase status`) para no fijar ninguna clave en el repositorio.
function localSupabaseEnv(): { url: string; secretKey: string } {
  const output = execSync("supabase status -o env", { encoding: "utf8" });
  const get = (name: string) =>
    output.match(new RegExp(`^${name}="?([^"\n]+)"?$`, "m"))?.[1];

  const url = process.env.SUPABASE_URL ?? get("API_URL");
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? get("SECRET_KEY");
  if (!url || !secretKey) {
    throw new Error(
      "No se pudo resolver la URL o la clave secreta de Supabase local. ¿Está corriendo `supabase start`?",
    );
  }
  return { url, secretKey };
}

describe("integration harness", () => {
  it("consulta la base de datos local de Supabase", async () => {
    const { url, secretKey } = localSupabaseEnv();
    const supabase = createClient(url, secretKey, {
      // Node 20 no trae WebSocket nativo; realtime-js lo exige al construir el cliente.
      realtime: { transport: ws as unknown as typeof WebSocket },
    });

    const { data, error } = await supabase.auth.admin.listUsers();

    expect(error).toBeNull();
    expect(Array.isArray(data.users)).toBe(true);
  });
});
