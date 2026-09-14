/**
 * Cómo se nombra al administrador de la plataforma ante las personas
 * (KAM-26). Es también, letra por letra, el `actor_label` que `log_activity()`
 * guarda cuando actúa en una organización ajena
 * (`supabase/migrations/20260914120000_platform_admins.sql`): si una cambia,
 * la otra también.
 */
export const PLATFORM_ADMIN_LABEL = "Administrador de la plataforma";
