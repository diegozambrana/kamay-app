# Graph Report - kamay-app  (2026-08-20)

## Corpus Check
- 169 files · ~117,537 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1360 nodes · 1985 edges · 96 communities (86 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `432dacfa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 89|Community 89]]

## God Nodes (most connected - your core abstractions)
1. `getOwnerContext()` - 43 edges
2. `7. Mapa de Vistas / Pantallas` - 24 edges
3. `cn()` - 23 edges
4. `Kamay — Esquema de Base de Datos (Supabase / PostgreSQL)` - 21 edges
5. `Button()` - 16 edges
6. `StatusService` - 15 edges
7. `Kamay — Arquitectura del Proyecto` - 15 edges
8. `Kamay — Mapa de Interfaz y Navegación` - 15 edges
9. `Kamay — Documento de Especificación de Producto` - 15 edges
10. `resolvePostAuthPath()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `GeneralSettingsPage()` --calls--> `getOwnerContext()`  [EXTRACTED]
  app/(app)/settings/general/page.tsx → lib/auth/session-context.ts
- `UnitsSettingsPage()` --calls--> `getOwnerContext()`  [EXTRACTED]
  app/(app)/settings/units/page.tsx → lib/auth/session-context.ts
- `MembersSettingsPage()` --calls--> `getOwnerContext()`  [EXTRACTED]
  app/(app)/settings/members/page.tsx → lib/auth/session-context.ts
- `CategoriesSettingsPage()` --calls--> `getOwnerContext()`  [EXTRACTED]
  app/(app)/settings/categories/page.tsx → lib/auth/session-context.ts
- `LinesSettingsPage()` --calls--> `getOwnerContext()`  [EXTRACTED]
  app/(app)/settings/lines/page.tsx → lib/auth/session-context.ts

## Communities (96 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (47): ActionResult, applyOrganizationStatuses(), archiveSchema, archiveStatus(), createOwnStatusSet(), createStatus(), id, reorderSchema (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (44): selectBusinessLine(), AppLayout(), getSessionContext(), SessionContext, findActiveLine(), preselectedLineId(), resolveActiveLine(), ajena (+36 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (49): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules() (+41 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (34): AuthActionResult, emailSchema, login(), loginSchema, passwordSchema, selectOrganization(), updatePassword(), InviteForm() (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (30): ActionResult, FormValues, schema, CLASSES, isLineColor(), LINE_COLOR_LABELS, LineColorClasses, LineOption() (+22 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (29): client, first, inserted, orgRow, params, second, statusRow, Call (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (44): 10. Diferencias por rol, 11. Adaptación móvil por vista, 12. Estados transversales, 13. Diagrama para visualizar, 14. Lista de verificación de navegación, 1. Para qué sirve este documento, 2.1 El dispositivo define el punto de partida, 2.2 El selector de línea es contexto, no un filtro más (+36 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (26): acceptInvitation(), archiveMembership(), changeMemberRole(), inviteMember(), InviteResult, inviteSchema, MemberActionResult, membershipSchema (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (33): ADDED Requirements, org-configuration Specification, Purpose, Requirement: A new business line is usable immediately, Requirement: Archiving hides a line from new work without erasing its history, Requirement: Configuration tables exist with the canonical shape, Requirement: Exactly one shared business line exists and cannot be archived, Requirement: Geeko Store is seeded with its real lines and channels (+25 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (34): Cómo usar este backlog, Convención de criterios de aceptación, Definición de terminado (aplica a todas las tareas), FASE 0 · Cimientos, FASE 1 · El ciclo del dinero, FASE 2 · Tareas, FASE 3 · Control y análisis, FASE 4 · Conexión y auditoría (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (33): ADDED Requirements, Purpose, Requirement: Aislamiento y permisos de la tabla de estados, Requirement: Archivar un estado en uso exige reasignación, Requirement: Comparación por tipo, nunca por nombre, Requirement: Integridad del juego — al menos un inicial y un final, Requirement: Los cambios de configuración no reescriben la historia, Requirement: Pantalla de configuración de estados (V22) (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (31): 6.1 Modelo conceptual — el contrato del sistema, 6.2 Estados y flujos de trabajo, 6.3 Módulo de Tareas, 6.4 Bitácora de actividad, 6.5 Archivado en lugar de eliminación *(decisión tomada)*, 6.6 Imprescindibles (núcleo), 6.7 Deseables (fases posteriores), 6.8 Fuera de alcance (+23 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (29): Base de datos (migraciones), code:mermaid (flowchart LR), code:block2 (lint → typecheck → test:unit → supabase start → test:integra), code:block3 (openspec/), code:bash (pipx install graphifyy          # o: uv tool install graphif), code:bash (npm run dev              # desarrollo (puerto 3010)), Convenciones que conviene preservar, Datos de prueba (+21 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (25): ADDED Requirements, MODIFIED Requirements, Purpose, Requirement: Authenticated shell frames every app screen, Requirement: Password recovery is available, Requirement: Session is refreshed on every request, Requirement: Sign-in lands on the device-appropriate home, Requirement: Unauthenticated access is redirected to login (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (25): ADDED Requirements, Purpose, Requirement: Accepting a valid invitation creates the membership, Requirement: Invitations are stored per organization with a single-use token, Requirement: Inviting a user never requires elevated privileges, Requirement: Only the owner manages invitations, and no one reads another organization's, Requirement: The owner archives a membership and the access stops, Requirement: The owner changes the role of an existing membership (+17 more)

### Community 15 - "Community 15"
Cohesion: 0.1
Nodes (24): ADDED Requirements, project-foundation Specification, Purpose, Requirement: Application shell boots with theme switching, Requirement: Continuous integration enforces the pipeline, Requirement: Knowledge graph is versioned and self-updating, Requirement: Local Supabase environment is reproducible, Requirement: OpenSpec project conventions are recorded (+16 more)

### Community 16 - "Community 16"
Cohesion: 0.1
Nodes (24): activity-log Specification, ADDED Requirements, Purpose, Requirement: Action kind is derived from the nature of the change, Requirement: Activity log table stores every audited event, Requirement: Every INSERT on an audited table produces a created event, Requirement: Existing tables are audited and future tables must opt in at creation, Requirement: Successive edits by the same author are merged (+16 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (24): archiveConfigurationItem(), archiveSchema, createBusinessLine(), createExpenseCategory(), createUnit(), entities, Entity, generalSchema (+16 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (24): 7. Mapa de Vistas / Pantallas, V10 · Catálogo, V11 · Detalle de ítem, V12 · Activos, V13 · Contactos, V14 · Reportes, V15 · Configuración de la organización, V16 · Registro rápido (móvil) (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (20): ADDED Requirements, Purpose, Requirement: Membership helper functions decide all access, Requirement: No authenticated user can delete anything, Requirement: Organizations and memberships model the tenant, Requirement: Row Level Security isolates organizations completely, Requirement: Write access to tenant tables is owner-only, Requirements (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (19): ADDED Requirements, business-line-context Specification, Purpose, Requirement: The active line is resolved on the server before the first render, Requirement: The active line preselects the line in creation forms, Requirement: The selection survives navigation between sections, Requirement: The selection survives the end of the session, Requirement: The shell offers a global business line selector (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.1
Nodes (19): code:block1 (resolveActiveLine(cookieValue, activeLines) → { id: string, ), Context, D10 · El color es un token, no una clase de Tailwind, D11 · La semilla añade Geeko Store; no reemplaza las organizaciones de prueba, D12 · Pruebas, D1 · Dos migraciones nuevas, no una, D2 · El invariante de la línea compartida se garantiza con índice + trigger, D3 · RLS de configuración: lectura de miembro, escritura de dueño, más grants explícitos (+11 more)

### Community 22 - "Community 22"
Cohesion: 0.1
Nodes (19): code:block1 (resolveActiveLine(cookieValue, activeLines) → { id: string, ), Context, D10 · El color es un token, no una clase de Tailwind, D11 · La semilla añade Geeko Store; no reemplaza las organizaciones de prueba, D12 · Pruebas, D1 · Dos migraciones nuevas, no una, D2 · El invariante de la línea compartida se garantiza con índice + trigger, D3 · RLS de configuración: lectura de miembro, escritura de dueño, más grants explícitos (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (15): Context, D1 · Una sola migración de tenant con sus dos pruebas pgTAP, D2 · Escrituras en tablas de tenant: solo dueño, D3 · Sesión con `@supabase/ssr` y middleware mínimo, D4 · Retorno a la ruta original vía parámetro `next`, D5 · Aterrizaje por dispositivo con user-agent en el servidor, D6 · Organización activa en cookie + `OrganizationProvider`, D7 · Sin registro público, cuentas por semilla (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (15): Context, D1 · Una sola migración de tenant con sus dos pruebas pgTAP, D2 · Escrituras en tablas de tenant: solo dueño, D3 · Sesión con `@supabase/ssr` y middleware mínimo, D4 · Retorno a la ruta original vía parámetro `next`, D5 · Aterrizaje por dispositivo con user-agent en el servidor, D6 · Organización activa en cookie + `OrganizationProvider`, D7 · Sin registro público, cuentas por semilla (+7 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (10): [archivePayload], channelRow, client, lineRow, [payload], service, [unarchivePayload], ExpenseCategoryRow (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (14): Context, D1 · Una migración única `..._activity_log.sql`, D2 · Resolución de `organization_id` dentro del trigger, D3 · Fusión de ruido dentro del propio trigger, D4 · `security definer` + revocación de privilegios, D5 · Diff con `jsonb_each` e ignorados fijos, D6 · `origin` desde cabecera, tolerante a ausencia, D7 · Procedimiento documentado para tablas futuras (+6 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (14): Context, D1 · Una migración única `..._activity_log.sql`, D2 · Resolución de `organization_id` dentro del trigger, D3 · Fusión de ruido dentro del propio trigger, D4 · `security definer` + revocación de privilegios, D5 · Diff con `jsonb_each` e ignorados fijos, D6 · `origin` desde cabecera, tolerante a ausencia, D7 · Procedimiento documentado para tablas futuras (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (12): 14. Próximos Pasos, 1. Resumen Ejecutivo, 3.1 Dueño / administrador, 3.2 Ayudante / operador (1 o 2 personas), 3.3 Organizaciones futuras, 3. Público Objetivo, 4. Tipo de Producto Digital, 9. Necesidad de Datos y Persistencia (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (7): createSalesChannel(), ChannelsSettingsPage(), metadata, SalesChannelRow, SalesChannelService, NamedSection(), SalesChannel

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (11): 1. Modelo conceptual, 2. Migración de configuración, 3. Migración de invitaciones y membresías, 4. Semilla de Geeko Store, 5. Servicios y tipos, 6. Contexto de línea, 7. Pantalla de configuración, 8. Usuarios y roles (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.2
Nodes (6): UnitRow, UnitService, UnitsSection(), Unit, metadata, UnitsSettingsPage()

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (10): 1. Base del proyecto, 2. Tema y UI base, 3. Estructura de carpetas, 4. Supabase local, 5. Arnés de pruebas, 6. OpenSpec, 7. Graphify, 8. Integración continua (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (10): 1. Modelo conceptual, 2. Migración de configuración, 3. Migración de invitaciones y membresías, 4. Semilla de Geeko Store, 5. Servicios y tipos, 6. Contexto de línea, 7. Pantalla de configuración, 8. Usuarios y roles (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (10): 1. Base del proyecto, 2. Tema y UI base, 3. Estructura de carpetas, 4. Supabase local, 5. Arnés de pruebas, 6. OpenSpec, 7. Graphify, 8. Integración continua (+2 more)

### Community 35 - "Community 35"
Cohesion: 0.2
Nodes (10): 8. Flujo de Usuario, Flujo A — Pedido de sublimación, de principio a fin, Flujo B — Pieza de alfarería, de la arcilla a la feria, Flujo C — Primeros encargos de 3D, Flujo D — Pedido de llaveros y falta de filamento, Flujo E — Día de feria, Flujo F — "Este número no cuadra", Flujo G — Recuperar algo archivado por error (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.2
Nodes (10): 11. Vistas derivadas, 13. Adjuntos, 8. Egresos, 9. Pedidos y ventas, Cobros y pagos, code:sql (-- Una sola bandeja: compras (traen material) y gastos (no t), code:sql (create table payments (), code:sql (-- Saldo actual por ítem) (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.2
Nodes (9): 17. Sincronización sin conexión, 19. Lo que este esquema aún no incluye, 1. Alcance y advertencia, 20. Lista de verificación antes de producción, 2. Cómo se traducen los principios, 3. Convenciones, 4. Mapa de entidades, code:mermaid (erDiagram) (+1 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (6): handle, initialRow, list, renamed, row, target

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (6): archive(), list(), listActive(), listAll(), patch(), unarchive()

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (9): 15. Notificaciones, 18. Orden de migraciones, code:sql (create trigger audit after insert or update on orders), code:sql (create table notifications (), code:sql (create policy "tasks: ayudante ve su línea o lo asignado"), code:block27 (001_extensions_and_helpers    -- pgcrypto, is_member(), is_o), code:sql (-- Líneas), Ejemplo de política más fina — tareas del ayudante (+1 more)

### Community 41 - "Community 41"
Cohesion: 0.31
Nodes (9): 6. Configuración, 7. Directorio y catálogo, code:sql (-- Líneas de negocio: Sublimación, Impresión 3D, Alfarería, ), code:sql (create table invitations (), code:sql (-- Valida token, caducidad y correo; crea la membresía y mar), code:sql (create table statuses (), code:sql (create or replace function resolve_statuses(org uuid, line u), Estados — la tabla que sostiene la flexibilidad (+1 more)

### Community 42 - "Community 42"
Cohesion: 0.22
Nodes (9): 10. Inventario, 12. Tareas, code:sql (-- Ítems: insumos, productos y activos en una sola tabla, di), code:sql (create table orders (), code:sql (create table inventory_movements (), code:sql (create table tasks (), code:sql (create policy "storage: solo la propia organización"), Storage (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.22
Nodes (8): Capabilities, Fuera de alcance, Impact, KAM-01 · Andamiaje del proyecto y disciplina de trabajo, Modified Capabilities, New Capabilities, What Changes, Why

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (8): 1. Base de datos: modelo de tenant, 2. Pruebas pgTAP (deltas `tenant-isolation`), 3. Clientes Supabase y middleware, 4. Pantallas de autenticación (V1), 5. Cascarón autenticado, 6. Pruebas e2e (delta `user-auth`), 7. Cierre, KAM-02 · Tareas

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (8): Capabilities, Fuera de alcance, Impact, KAM-02 · Autenticación, organizaciones y aislamiento, Modified Capabilities, New Capabilities, What Changes, Why

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (8): 1. Base de datos: modelo de tenant, 2. Pruebas pgTAP (deltas `tenant-isolation`), 3. Clientes Supabase y middleware, 4. Pantallas de autenticación (V1), 5. Cascarón autenticado, 6. Pruebas e2e (delta `user-auth`), 7. Cierre, KAM-02 · Tareas

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (8): Capabilities, Fuera de alcance, Impact, KAM-02 · Autenticación, organizaciones y aislamiento, Modified Capabilities, New Capabilities, What Changes, Why

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (8): Capabilities, Fuera de alcance, Impact, KAM-01 · Andamiaje del proyecto y disciplina de trabajo, Modified Capabilities, New Capabilities, What Changes, Why

### Community 49 - "Community 49"
Cohesion: 0.25
Nodes (5): general, name, nav, option, row

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (8): 12. Alcance y Fases (Roadmap), Fase 0 — Cimientos *(no negociable, va primero)*, Fase 1 — MVP: el ciclo del dinero, Fase 2 — Tareas: el trabajo propio, Fase 3 — Inventario suave, activos y reportes, Fase 4 — Bitácora completa y tareas conectadas, Fase 5 — Precisión y producción, Fase 6 — Cara al cliente y expansión

### Community 51 - "Community 51"
Cohesion: 0.25
Nodes (7): Capabilities, Impact, KAM-03 · Bitácora desde el primer día, Modified Capabilities, New Capabilities, What Changes, Why

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (7): Capabilities, Impact, KAM-04 · Configuración de la organización y semilla, Modified Capabilities, New Capabilities, What Changes, Why

### Community 53 - "Community 53"
Cohesion: 0.25
Nodes (7): Context, Decisions, Design — KAM-01 · Andamiaje del proyecto, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 54 - "Community 54"
Cohesion: 0.25
Nodes (7): Context, Decisions, Goals / Non-Goals, KAM-05 · Diseño, Migration Plan, Open Questions, Risks / Trade-offs

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (7): Capabilities, Impact, KAM-05 · Estados configurables por línea, Modified Capabilities, New Capabilities, What Changes, Why

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (7): Capabilities, Impact, KAM-04 · Configuración de la organización y semilla, Modified Capabilities, New Capabilities, What Changes, Why

### Community 57 - "Community 57"
Cohesion: 0.25
Nodes (7): Capabilities, Impact, KAM-03 · Bitácora desde el primer día, Modified Capabilities, New Capabilities, What Changes, Why

### Community 58 - "Community 58"
Cohesion: 0.25
Nodes (7): Context, Decisions, Design — KAM-01 · Andamiaje del proyecto, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 59 - "Community 59"
Cohesion: 0.29
Nodes (5): cookieValues, getUser, listActiveForUser, USER, value

### Community 60 - "Community 60"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, ThemeProvider()

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (7): 11. Consideraciones de Buenas Prácticas, Facilidad de uso, Mantenibilidad — la lección de la versión anterior, Notificaciones sin fatiga, Rendimiento, Seguridad y privacidad, SEO

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (7): 16. Seguridad a nivel de fila (RLS), Bitácora: inalterable de verdad, Cómo se ocultan los costos al ayudante, code:sql (alter table orders enable row level security;), code:sql (alter table activity_log enable row level security;), Matriz de acceso, Patrón general

### Community 63 - "Community 63"
Cohesion: 0.38
Nodes (7): 14. Bitácora de actividad, Agrupación de ruido, code:sql (create table activity_log (), code:sql (create or replace function log_activity()), code:sql (-- Tarea programada mensual (pg_cron): exportar y luego resu), El trigger genérico, Retención

### Community 64 - "Community 64"
Cohesion: 0.29
Nodes (4): Cómo auditar una tabla nueva, Migraciones, Prueba obligatoria, Qué se audita y qué no

### Community 65 - "Community 65"
Cohesion: 0.29
Nodes (6): 1. Base de datos, 2. Pruebas pgTAP (`supabase/tests/status_integrity.test.sql`), 3. Servicio y acciones, 4. Pantalla V22 (`features/settings/statuses/` + `app/(app)/settings/statuses/`), 5. E2E y cierre, KAM-05 · Tareas

### Community 66 - "Community 66"
Cohesion: 0.29
Nodes (4): Cómo auditar una tabla nueva, Migraciones, Prueba obligatoria, Qué se audita y qué no

### Community 67 - "Community 67"
Cohesion: 0.33
Nodes (5): 1. Migración de la bitácora, 2. Pruebas pgTAP, 3. Procedimiento para tablas futuras, 4. Cierre, KAM-03 · Tareas — Bitácora desde el primer día

### Community 68 - "Community 68"
Cohesion: 0.33
Nodes (5): 1. Migración de la bitácora, 2. Pruebas pgTAP, 3. Procedimiento para tablas futuras, 4. Cierre, KAM-03 · Tareas — Bitácora desde el primer día

### Community 69 - "Community 69"
Cohesion: 0.4
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

### Community 70 - "Community 70"
Cohesion: 0.4
Nodes (5): 10. Integraciones y Funcionalidades de Terceros, Deliberadamente evitado, Deseables después, Necesarias, Puerta de conexión con otras plataformas *(preparación futura)*

### Community 71 - "Community 71"
Cohesion: 0.4
Nodes (4): Convenciones no negociables, Kamay — Constitución del proyecto, Pruebas, Stack

### Community 73 - "Community 73"
Cohesion: 0.5
Nodes (4): 2. Objetivo del Negocio, Cómo se mide el éxito, Objetivo principal, Objetivos secundarios

### Community 74 - "Community 74"
Cohesion: 0.5
Nodes (4): 13. Riesgos, Dudas y Decisiones Pendientes, Decisiones abiertas (no bloqueantes), Decisiones ya resueltas, Riesgos

### Community 75 - "Community 75"
Cohesion: 0.5
Nodes (4): 5. Propuesta de Valor y Tono de Marca, Diferenciadores frente a la versión anterior, Propuesta de valor interna, Tono y personalidad

### Community 76 - "Community 76"
Cohesion: 0.5
Nodes (4): 5. Identidad y multi-tenant, code:sql (-- Organizaciones (tenants)), code:sql (create or replace function is_member(org uuid)), Funciones auxiliares de seguridad

## Knowledge Gaps
- **664 isolated node(s):** `config`, `config`, `eslintConfig`, `nextConfig`, `geistSans` (+659 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getOwnerContext()` connect `Community 0` to `Community 1`, `Community 3`, `Community 5`, `Community 7`, `Community 17`, `Community 29`, `Community 31`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `InvitationService` connect `Community 7` to `Community 5`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 3` to `Community 1`, `Community 7`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `config`, `config`, `eslintConfig` to the rest of the system?**
  _664 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._