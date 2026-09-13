/**
 * Lo que delata una clave de service role dentro de un archivo servido al
 * navegador (KAM-23, design D14). Tres señales, de la más a la menos exacta:
 *
 * 1. **El valor configurado**, tal cual, si se conoce en el entorno de la
 *    comprobación.
 * 2. **Una clave secreta del formato nuevo** (`sb_secret_…`), sea cual sea:
 *    ninguna tiene motivo para estar en el cliente.
 * 3. **Un JWT del formato antiguo cuyo rol es `service_role`**: se decodifica
 *    cada token con forma de JWT y se mira su carga. La llave pública también
 *    es un JWT, y es legítimo que viaje; lo que se busca es el rol.
 *
 * Devuelve qué señal apareció, nunca el valor encontrado: el informe de un
 * fallo no puede ser la filtración.
 */

const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{8,}/;
const JWT = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/**
 * @param {string} text
 * @param {string | undefined} knownSecret
 * @returns {string[]}
 */
export function findServiceRoleLeaks(text, knownSecret) {
  const leaks = [];
  const secret = knownSecret?.trim();

  if (secret && text.includes(secret)) leaks.push("el valor de SUPABASE_SERVICE_ROLE_KEY");
  if (SECRET_KEY.test(text)) leaks.push("una clave secreta sb_secret_…");

  for (const token of text.match(JWT) ?? []) {
    if (roleOf(token) === "service_role") {
      leaks.push("un JWT con rol service_role");
      break;
    }
  }

  return leaks;
}

/** @param {string} token */
function roleOf(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    return JSON.parse(json).role;
  } catch {
    return undefined;
  }
}
