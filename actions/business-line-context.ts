"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { LINE_COOKIE_MAX_AGE, lineCookieName } from "@/constants/auth";
import { getSessionContext } from "@/lib/auth/session-context";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { ALL_LINES } from "@/types";

/**
 * Fija la línea activa. La cookie es `httpOnly`, así que este es el único punto
 * que la escribe — y el único que revalida, de modo que los Server Components
 * nunca se quedan renderizando con la línea anterior (D4).
 */
export async function selectBusinessLine(lineId: string): Promise<void> {
  const context = await getSessionContext();
  if (!context) return;

  let value: string = ALL_LINES;

  if (lineId !== ALL_LINES) {
    // Solo se acepta una línea vigente de esta organización: una cookie con
    // basura no rompería nada, pero tampoco tiene por qué escribirse.
    const lines = await new BusinessLineService(context.supabase).listActive(
      context.organizationId,
    );
    if (!lines.some((line) => line.id === lineId)) return;
    value = lineId;
  }

  const cookieStore = await cookies();
  cookieStore.set(lineCookieName(context.organizationId), value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: LINE_COOKIE_MAX_AGE,
  });

  revalidatePath("/", "layout");
}
