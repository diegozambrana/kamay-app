import type { Instrumentation } from "next";

import { ORG_COOKIE } from "@/constants/auth";
import { assertEnv } from "@/lib/env";
import { reportError } from "@/lib/monitoring/report-error";

/**
 * Se ejecuta una vez al levantar cada instancia del servidor, antes de atender
 * ninguna petición: el sitio donde un entorno incompleto debe fallar —con el
 * nombre de lo que falta— y no en la primera operación de alguien (KAM-23).
 */
export function register() {
  assertEnv(process.env, process.env.NODE_ENV);
}

/**
 * Todo error no controlado del servidor —al rendir, en una ruta, en una acción
 * o en el proxy— llega al monitoreo con su ruta **como plantilla**
 * (`/orders/[id]`, nunca la dirección con su consulta) y la organización
 * activa. De la petición no se toma nada más: ni cabeceras ni cookies viajan
 * en el reporte (`lib/monitoring/scrub.ts`).
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  reportError(error, {
    route: context.routePath,
    runtime: context.routeType,
    organizationId: organizationFrom(request.headers.cookie),
  });
};

function organizationFrom(cookie: string | string[] | undefined): string | undefined {
  const header = Array.isArray(cookie) ? cookie.join("; ") : (cookie ?? "");
  const match = header.match(new RegExp(`(?:^|;\\s*)${ORG_COOKIE}=([^;]+)`));
  return match?.[1];
}
