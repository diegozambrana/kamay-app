import { z } from "zod";

/**
 * Las variables de entorno que la aplicación necesita, comprobadas **al
 * compilar y al arrancar** (`next.config.ts`) y no en la primera operación
 * que las use (KAM-23, design D14).
 *
 * Sin esto, un despliegue al que le falta `SUPABASE_SERVICE_ROLE_KEY` arranca
 * sano y falla horas después, en el trabajo programado; y uno sin
 * `CRON_SECRET` no falla nunca: el resumen diario rechaza en silencio cada
 * llamada del programador. Lo que se reporta es el **nombre** de la variable,
 * jamás su valor.
 */

const required = z.string({ error: "falta" }).trim().min(1, "falta");

/** Las que ninguna ejecución del servidor puede omitir. */
const ALWAYS = {
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "falta o no es una URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required,
  SUPABASE_SERVICE_ROLE_KEY: required,
};

/**
 * Las que en desarrollo pueden faltar —el Cron no llama a nadie en local y los
 * correos no salen—, pero no en una compilación de producción: ahí faltar es
 * un despliegue mal configurado.
 */
const PRODUCTION = {
  // Vercel pide al menos 16 caracteres; uno más corto se adivina.
  CRON_SECRET: z
    .string({ error: "falta" })
    .trim()
    .min(1, "falta")
    .min(16, "tiene menos de 16 caracteres"),
  APP_URL: z.url({ error: "falta o no es una URL" }),
};

/**
 * La asistencia de redacción por IA (KAM-30): un grupo genuinamente
 * **opcional**, en desarrollo y en producción por igual. Ausente, no es un
 * problema — la función queda apagada para toda organización, sin importar su
 * interruptor propio (spec `ai-writing-assist` → "La función se apaga por
 * completo si falta su configuración"); presente pero mal formada, sí lo es,
 * con el mismo trato que el resto del módulo: se nombra la variable, nunca el
 * valor.
 */
const AI_WRITING_ASSIST = {
  ANTHROPIC_API_KEY: z.string().trim().min(1, "está vacía").optional(),
  AI_WRITING_ASSIST_MONTHLY_LIMIT: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, "no es un entero positivo")
    .optional(),
};

export type EnvProblem = { name: string; problem: string };

type Env = Record<string, string | undefined>;

/** Secretos que ninguna variable pública puede llevar, con su rótulo. */
const NEVER_PUBLIC: { name: string; label: string }[] = [
  { name: "SUPABASE_SERVICE_ROLE_KEY", label: "la clave de service role" },
  { name: "ANTHROPIC_API_KEY", label: "la credencial de IA" },
];

/** Los problemas del entorno, por nombre. Vacío si todo está en orden. */
export function envProblems(env: Env, mode: string | undefined): EnvProblem[] {
  const shape = {
    ...ALWAYS,
    ...(mode === "production" ? PRODUCTION : {}),
    ...AI_WRITING_ASSIST,
  };
  const problems: EnvProblem[] = [];

  for (const [name, schema] of Object.entries(shape)) {
    const parsed = schema.safeParse(env[name]);
    if (!parsed.success) {
      problems.push({ name, problem: parsed.error.issues[0]?.message ?? "no es válida" });
    }
  }

  // La frontera de secretos: ninguna variable pública —las que Next incrusta
  // en el paquete del navegador— puede llevar un secreto de servidor.
  for (const { name: secretName, label } of NEVER_PUBLIC) {
    const secret = env[secretName]?.trim();
    if (!secret) continue;

    for (const [name, value] of Object.entries(env)) {
      if (name.startsWith("NEXT_PUBLIC_") && value?.trim() === secret) {
        problems.push({ name, problem: `contiene ${label}` });
      }
    }
  }

  return problems;
}

/** Lanza, nombrando cada variable con problemas, si el entorno no sirve. */
export function assertEnv(env: Env, mode: string | undefined): void {
  const problems = envProblems(env, mode);
  if (problems.length === 0) return;

  throw new Error(
    `Kamay no puede arrancar: revisa las variables de entorno — ${problems
      .map(({ name, problem }) => `${name} (${problem})`)
      .join(", ")}. La lista completa está en .env.example.`,
  );
}
