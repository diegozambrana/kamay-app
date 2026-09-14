/**
 * «MC» de «Marcela Cruz». Sin nombre no hay iniciales que inventar.
 *
 * Compartido entre la bitácora (autor del evento) y el menú de cuenta
 * (avatar del usuario con sesión, KAM-24): un solo lugar decide cómo se
 * abrevia un nombre, para que ambas superficies no puedan discreparse.
 */
export function initialsOf(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}
