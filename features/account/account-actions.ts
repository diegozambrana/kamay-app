/**
 * Los dos ítems de "acciones de cuenta" (KAM-24), iguales para el dueño y el
 * ayudante. No son entradas de `nav-entries.ts`: esa lista está tipada por
 * `roles` y por ranura de navegación (barra/"Más"), dos conceptos que no
 * aplican aquí, y Perfil/Cerrar sesión ya están disponibles para ambos roles
 * por igual (design D4).
 *
 * Una sola declaración de las etiquetas y el destino de "Perfil" para que el
 * menú de escritorio (`UserMenu`) y el bloque del panel "Más" móvil
 * (`MobileNav`) no puedan decir cosas distintas.
 */
export const PROFILE_HREF = "/profile";

export const ACCOUNT_ACTION_LABELS = {
  profile: "Perfil",
  signOut: "Cerrar sesión",
} as const;
