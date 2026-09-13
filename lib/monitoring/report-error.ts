import { type MonitoringContext, type MonitoringEvent, scrubEvent } from "./scrub";

export type { MonitoringContext, MonitoringEvent } from "./scrub";

/**
 * Quien entrega el reporte al servicio de monitoreo. `null` mientras no haya
 * proveedor provisionado —como el correo de KAM-17—: el reporte depurado queda
 * en el registro de la función y no sale hacia ningún tercero.
 */
export type MonitoringTransport = (event: MonitoringEvent) => void | Promise<unknown>;

let transport: MonitoringTransport | null = null;

/** Lo que el navegador sabe de la sesión: la organización activa. */
let browserScope: Pick<MonitoringContext, "organizationId"> = {};

/** El adaptador del proveedor se enchufa aquí, y ningún otro archivo cambia. */
export function setMonitoringTransport(next: MonitoringTransport | null): void {
  transport = next;
}

/**
 * Solo en el navegador, donde hay una persona por pestaña. En el servidor cada
 * llamada pasa su organización: un ámbito compartido mezclaría peticiones.
 */
export function setBrowserMonitoringScope(
  scope: Pick<MonitoringContext, "organizationId">,
): void {
  browserScope = scope;
}

/** La compilación desplegada: la inyecta `next.config.ts` desde Vercel. */
function release(): string {
  return process.env.KAMAY_RELEASE || "local";
}

function toEvent(error: unknown, context: MonitoringContext): MonitoringEvent {
  const inBrowser = typeof window !== "undefined";
  const base = error instanceof Error ? error : new Error(String(error));
  const digest = (error as { digest?: unknown } | null)?.digest;

  return {
    name: base.name,
    message: base.message,
    stack: base.stack,
    release: release(),
    context: {
      ...(inBrowser ? browserScope : {}),
      ...(inBrowser ? { route: window.location.pathname, runtime: "browser" } : {}),
      ...(typeof digest === "string" ? { digest } : {}),
      ...context,
    },
  };
}

/**
 * El único punto por el que un error llega a registrarse.
 *
 * Depura antes de hacer nada (`scrubEvent`), escribe el reporte depurado en el
 * registro y lo entrega al proveedor si lo hay. **Nunca lanza ni espera**: un
 * monitoreo caído, lento o mal configurado no puede convertirse en un segundo
 * error encima del primero, ni retrasar la pantalla que está fallando.
 */
export function reportError(error: unknown, context: MonitoringContext = {}): void {
  try {
    const event = scrubEvent(toEvent(error, context));
    console.error("[kamay]", event.context, `${event.name}: ${event.message}`);

    const pending = transport?.(event);
    if (pending instanceof Promise) pending.catch(() => undefined);
  } catch {
    // Nada que hacer: reportar es lo último que debe romper la pantalla.
  }
}
