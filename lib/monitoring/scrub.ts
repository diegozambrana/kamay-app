/**
 * La depuración explícita de un reporte de error **antes** de que salga hacia
 * el monitoreo (KAM-23, spec `production-operations` → *Errors are monitored
 * in server and browser without leaking personal data*).
 *
 * Dos defensas, y la primera es la que manda:
 *
 * 1. **El contexto es una lista cerrada.** Solo viajan la versión, la ruta, la
 *    organización, el límite o trabajo que falló y el `digest` de Next. Ni la
 *    petición, ni sus cabeceras, ni sus cookies, ni el registro que se estaba
 *    tocando: lo que no está en la lista se descarta, aunque alguien lo pase.
 * 2. **El texto del error se limpia por forma.** Los mensajes de Kamay son
 *    plantillas sin datos, pero envuelven los de PostgREST y Postgres, que sí
 *    los traen: el valor entre comillas, la clave duplicada, la fila que no
 *    pasó una restricción. Se sustituye todo lo que tiene forma de correo,
 *    teléfono, importe, texto citado o credencial.
 *
 * Lo que un patrón no puede reconocer —un nombre suelto en un mensaje— no se
 * escribe nunca en un mensaje de error: esa es la convención que la segunda
 * defensa respalda, no la que sustituye.
 */

export type MonitoringContext = {
  /** El límite de error que lo atrapó (`error.tsx` de una sección, «global»…). */
  boundary?: string;
  /** El trabajo programado que falló. */
  job?: string;
  organizationId?: string;
  /** La ruta, sin consulta: preferiblemente su plantilla (`/orders/[id]`). */
  route?: string;
  /** El identificador con el que Next enlaza el error del servidor. */
  digest?: string;
  /** Dónde ocurrió: `render`, `route`, `action`, `browser`… */
  runtime?: string;
};

export type MonitoringEvent = {
  name: string;
  message: string;
  stack?: string;
  release: string;
  context: MonitoringContext;
};

const CONTEXT_KEYS = ["boundary", "job", "organizationId", "route", "digest", "runtime"] as const;

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const UUID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const SUPABASE_KEY = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g;
const BEARER = /\bBearer\s+\S+/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_QUERY = /(\bhttps?:\/\/[^\s?#"']+|\/[^\s?#"']*)\?[^\s#"']*/g;
const PG_ROW = /(Failing row contains )\(.*?\)(?=\.?(?:\s|$))/g;
const PG_KEY = /\(([^()]*)\)=\(([^()]*)\)/g;
const QUOTED = /"[^"]*"|«[^»]*»|“[^”]*”|'[^']*'/g;
const CURRENCY = /(?:\b(?:Bs|BOB|USD)\.?\s?|\$\s?)\d[\d.,]*|\b\d[\d.,]*\s?(?:Bs|BOB|USD)\b/gi;
const AMOUNT = /\b\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?!\d)|\b\d+[.,]\d{2}(?!\d)/g;
const PHONE = /\+?\d[\d\s-]{5,}\d/g;
const UUID_SLOT = /\uE000(\d+)\uE001/g;
const STACK_LIMIT = 4000;

/** Un texto libre —mensaje o traza— sin nada con forma de dato personal. */
export function scrubText(text: string): string {
  // Los UUID se apartan antes: sus tramos de ceros parecen teléfonos, y un
  // identificador no es un dato personal. El marcador usa caracteres de uso
  // privado, que ningún mensaje trae.
  const uuids: string[] = [];
  const guarded = text.replace(UUID, (uuid) => `\uE000${uuids.push(uuid) - 1}\uE001`);

  const scrubbed = guarded
    .replace(JWT, "[credencial]")
    .replace(SUPABASE_KEY, "[credencial]")
    .replace(BEARER, "Bearer [credencial]")
    .replace(EMAIL, "[correo]")
    .replace(URL_QUERY, (_, path: string) => `${path}?[consulta]`)
    .replace(PG_ROW, "$1([fila])")
    .replace(PG_KEY, "($1)=([valor])")
    .replace(QUOTED, "[texto]")
    .replace(CURRENCY, "[importe]")
    .replace(AMOUNT, "[importe]")
    .replace(PHONE, "[número]");

  return scrubbed.replace(UUID_SLOT, (_, index: string) => uuids[Number(index)] ?? "");
}

/**
 * Una ruta sin consulta ni fragmento —la búsqueda de `/contacts?q=` lleva el
 * nombre de un cliente— y sin el token de una invitación, que es una
 * credencial.
 */
export function scrubRoute(route: string): string {
  const path = route.split(/[?#]/)[0] ?? "";
  return path
    .split("/")
    .map((segment, index, segments) => {
      if (segments[index - 2] === "auth" && segments[index - 1] === "invite") return "[token]";
      if (segment.startsWith("[")) return segment;
      if (!UUID_ONLY.test(segment) && /^[A-Za-z0-9_-]{24,}$/.test(segment)) return "[token]";
      return segment;
    })
    .join("/");
}

/** El reporte tal como puede salir: contexto cerrado y texto limpio. */
export function scrubEvent(event: MonitoringEvent): MonitoringEvent {
  const context: MonitoringContext = {};
  for (const key of CONTEXT_KEYS) {
    const value = event.context[key];
    if (typeof value !== "string" || value === "") continue;
    if (key === "organizationId" || key === "digest") {
      // Identificadores con forma fija: pasan tal cual o no pasan.
      const pattern = key === "organizationId" ? UUID_ONLY : /^[\w@-]+$/;
      if (pattern.test(value)) context[key] = value;
      continue;
    }
    context[key] = key === "route" ? scrubRoute(value) : scrubText(value);
  }

  return {
    name: scrubText(event.name),
    message: scrubText(event.message),
    stack: event.stack ? scrubText(event.stack.slice(0, STACK_LIMIT)) : undefined,
    release: event.release,
    context,
  };
}
