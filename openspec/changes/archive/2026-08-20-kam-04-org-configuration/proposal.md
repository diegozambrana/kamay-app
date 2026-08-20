# KAM-04 · Configuración de la organización y semilla

## Why

Kamay presume que todo es configurable sin programar: las líneas de negocio, los canales, las categorías de gasto y las unidades son datos de la organización, no constantes del código. Hoy no existe ninguna de esas tablas, y **KAM-05 en adelante dependen de ellas**: los estados se declaran por línea, el catálogo y el directorio se agrupan por línea, y los pedidos y egresos exigen `business_line_id not null`. Sin esta tarea no hay línea que seleccionar ni contexto que propagar, y Geeko Store no puede empezar a cargar datos reales.

## What Changes

- **Tablas de configuración** (esquema canónico §6): `business_lines`, `sales_channels`, `expense_categories` y `units`, cada una con `organization_id`, `archived_at`, su índice único por organización y el trigger `audit` en su propia migración (procedimiento de KAM-03).
- **Invariante de la línea compartida**: existe exactamente una `business_lines` con `is_shared = true` por organización, garantizada por índice único parcial, y no puede archivarse.
- **RLS de configuración**: lectura para todo miembro activo; `INSERT` y `UPDATE` solo para el dueño; sin política `DELETE` (convención nº 3).
- **`organizations.settings`** pasa a ser editable desde la pantalla de configuración (nombre, moneda, zona horaria, logo).
- **Pantalla de configuración (V15)** en `/settings`, solo dueño, con las secciones General, Líneas de negocio, Canales, Categorías, Unidades y Usuarios y roles. Un ayudante que entra por dirección directa es redirigido, y la entrada no aparece en su menú.
- **Selector de línea global**: componente en la barra superior con la opción "Todas" más las líneas activas y su color; el contexto se resuelve en el servidor desde una cookie por organización, se conserva al navegar entre secciones y sobrevive al cierre de sesión.
- **Gestión de usuarios**: invitar por correo, cambiar el rol de una membresía y archivarla. La invitación es una **tabla `invitations` con token y caducidad**: el dueño la crea sin privilegios elevados y una función `security definer` crea la membresía cuando el invitado acepta. Ninguna acción disparada por el usuario usa el cliente de service role (convención nº 2).
- **Semilla de Geeko Store** en `supabase/seed.sql`: las cuatro líneas reales (Sublimación `blue`, Impresión 3D `violet`, Alfarería `orange`, General/Compartido `zinc` con `is_shared = true`) y los cuatro canales (Feria, Redes, Pedido directo, Mostrador), disponibles tras `supabase db reset`.
- **Las líneas archivadas dejan de ofrecerse** en formularios y en el selector, pero los registros históricos que las referencian las siguen mostrando con su nombre y color.

**Fuera de alcance** (copiado literal del backlog):
- Configuración de estados (KAM-05) y de notificaciones (KAM-17).
- Política de retención de bitácora (KAM-22).
- Regla de reparto de gastos compartidos (KAM-20).
- Facturación de la aplicación o planes.

## Capabilities

### New Capabilities

- `org-configuration`: las cuatro tablas de configuración, su RLS de escritura solo-dueño, el invariante de la línea compartida, el archivado sin pérdida de historia, la pantalla `/settings` cerrada al ayudante y la semilla de Geeko Store.
- `business-line-context`: el selector de línea global como contexto del sistema — resolución de la línea activa en el servidor, persistencia entre secciones y entre sesiones, y precarga en los formularios de creación.
- `user-management`: invitación por correo con token y caducidad, aceptación que crea la membresía, cambio de rol y archivado de membresía, todo restringido al dueño y auditado.

### Modified Capabilities

- `user-auth`: el requisito "Authenticated shell frames every app screen" deja de admitir una barra superior sin contenido — la barra pasa a incluir el selector de línea y las entradas de menú visibles según el rol.

## Impact

- **Base de datos:** dos migraciones nuevas — `..._configuration.sql` (las cuatro tablas, índices, triggers `audit`, RLS) e `..._invitations.sql` (tabla `invitations`, función `accept_invitation()` `security definer`, RLS). Ninguna migración existente se edita.
- **Concepto nuevo:** `invitations` no figura en `specs/PRD/kamay-esquema-base-de-datos-supabase.md`; la convención nº 11 obliga a incorporarlo antes al modelo conceptual — esta tarea incluye esa anotación en el esquema canónico.
- **Código de aplicación:** primera rebanada vertical completa — `app/(app)/settings/`, `actions/configuration.ts` y `actions/members.ts`, `services/` (líneas, canales, categorías, unidades, invitaciones), `features/settings/`, `features/business-lines/` (selector), `stores/business-line-store.ts`, `components/layout/header.tsx` (selector + menú por rol) y `lib/auth/routes.ts` (`/settings` protegido y solo-dueño).
- **Semilla:** `supabase/seed.sql` incorpora Geeko Store sin tocar las organizaciones de prueba que usan las pruebas e2e de KAM-02.
- **Pruebas:** pgTAP `rls_roles` y `shared_line`; unitarias de persistencia y resolución de la línea activa; e2e de creación de línea y persistencia del selector al navegar.
- **Grafo:** regenerar `graphify .` tras las migraciones (convención nº 6).
- **Dependencias:** requiere KAM-03 archivado (hecho). Habilita KAM-05 (estados por línea) y KAM-06 (catálogo y directorio).
