# Graph Report - kamay-app  (2026-08-20)

## Corpus Check
- 81 files · ~69,924 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 707 nodes · 870 edges · 66 communities (55 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cfe301c3`
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
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]

## God Nodes (most connected - your core abstractions)
1. `7. Mapa de Vistas / Pantallas` - 24 edges
2. `Kamay — Esquema de Base de Datos (Supabase / PostgreSQL)` - 21 edges
3. `cn()` - 15 edges
4. `Kamay — Arquitectura del Proyecto` - 15 edges
5. `Kamay — Mapa de Interfaz y Navegación` - 15 edges
6. `Kamay — Documento de Especificación de Producto` - 15 edges
7. `resolvePostAuthPath()` - 13 edges
8. `8. Flujo de Usuario` - 10 edges
9. `Tasks — KAM-01 · Andamiaje del proyecto` - 10 edges
10. `Tasks — KAM-01 · Andamiaje del proyecto` - 10 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `resolvePostAuthPath()`  [EXTRACTED]
  app/auth/callback/route.ts → lib/auth/post-auth.ts
- `LoginPage()` --calls--> `resolvePostAuthPath()`  [EXTRACTED]
  app/auth/login/page.tsx → lib/auth/post-auth.ts
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  components/ui/card.tsx → lib/utils.ts
- `CardFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/card.tsx → lib/utils.ts
- `updatePassword()` --calls--> `resolvePostAuthPath()`  [EXTRACTED]
  actions/auth.ts → lib/auth/post-auth.ts

## Communities (66 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (49): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules() (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (37): AuthActionResult, emailSchema, login(), loginSchema, passwordSchema, selectOrganization(), updatePassword(), FormValues (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (24): user, ThemeToggle(), Header(), MainContainer(), MobileNav(), OrganizationProvider(), MEMBERSHIP, ORG (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (34): Cómo usar este backlog, Convención de criterios de aceptación, Definición de terminado (aplica a todas las tareas), FASE 0 · Cimientos, FASE 1 · El ciclo del dinero, FASE 2 · Tareas, FASE 3 · Control y análisis, FASE 4 · Conexión y auditoría (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): 6.1 Modelo conceptual — el contrato del sistema, 6.2 Estados y flujos de trabajo, 6.3 Módulo de Tareas, 6.4 Bitácora de actividad, 6.5 Archivado en lugar de eliminación *(decisión tomada)*, 6.6 Imprescindibles (núcleo), 6.7 Deseables (fases posteriores), 6.8 Fuera de alcance (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (29): Base de datos (migraciones), code:mermaid (flowchart LR), code:block2 (lint → typecheck → test:unit → supabase start → test:integra), code:block3 (openspec/), code:bash (pipx install graphifyy          # o: uv tool install graphif), code:bash (npm run dev              # desarrollo (puerto 3010)), Convenciones que conviene preservar, Datos de prueba (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (27): 10. Diferencias por rol, 11. Adaptación móvil por vista, 12. Estados transversales, 13. Diagrama para visualizar, 14. Lista de verificación de navegación, 1. Para qué sirve este documento, 2.1 El dispositivo define el punto de partida, 2.2 El selector de línea es contexto, no un filtro más (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (24): ADDED Requirements, project-foundation Specification, Purpose, Requirement: Application shell boots with theme switching, Requirement: Continuous integration enforces the pipeline, Requirement: Knowledge graph is versioned and self-updating, Requirement: Local Supabase environment is reproducible, Requirement: OpenSpec project conventions are recorded (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (22): ADDED Requirements, Purpose, Requirement: Authenticated shell frames every app screen, Requirement: Password recovery is available, Requirement: Session is refreshed on every request, Requirement: Sign-in lands on the device-appropriate home, Requirement: Unauthenticated access is redirected to login, Requirement: Users with multiple organizations must choose one (+14 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (24): 7. Mapa de Vistas / Pantallas, V10 · Catálogo, V11 · Detalle de ítem, V12 · Activos, V13 · Contactos, V14 · Reportes, V15 · Configuración de la organización, V16 · Registro rápido (móvil) (+16 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (20): ADDED Requirements, Purpose, Requirement: Membership helper functions decide all access, Requirement: No authenticated user can delete anything, Requirement: Organizations and memberships model the tenant, Requirement: Row Level Security isolates organizations completely, Requirement: Write access to tenant tables is owner-only, Requirements (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (15): 10. Inventario, 11. Vistas derivadas, 15. Notificaciones, 17. Sincronización sin conexión, 19. Lo que este esquema aún no incluye, 1. Alcance y advertencia, 20. Lista de verificación antes de producción, 2. Cómo se traducen los principios (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (17): 7. Flujos principales, vista por vista, code:block10 (V15 → sección Estados → V22), code:block11 (V17 o V10 → casilla "Ver archivados" → desarchivar), code:block4 (V16 o V3 → V5 (nuevo pedido) → V4 (detalle)), code:block5 (V16 → V9 (gasto del stand, antes de salir)), code:block6 (V16 o V17 → V18 (tarea con lista de verificación de la horna), code:block7 (V2 (alerta de insumo bajo mínimo) → V11 (detalle del insumo)), code:block8 (V11 → pestaña Movimientos → V23 filtrada por ese ítem) (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (15): Context, D1 · Una sola migración de tenant con sus dos pruebas pgTAP, D2 · Escrituras en tablas de tenant: solo dueño, D3 · Sesión con `@supabase/ssr` y middleware mínimo, D4 · Retorno a la ruta original vía parámetro `next`, D5 · Aterrizaje por dispositivo con user-agent en el servidor, D6 · Organización activa en cookie + `OrganizationProvider`, D7 · Sin registro público, cuentas por semilla (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (15): Context, D1 · Una sola migración de tenant con sus dos pruebas pgTAP, D2 · Escrituras en tablas de tenant: solo dueño, D3 · Sesión con `@supabase/ssr` y middleware mínimo, D4 · Retorno a la ruta original vía parámetro `next`, D5 · Aterrizaje por dispositivo con user-agent en el servidor, D6 · Organización activa en cookie + `OrganizationProvider`, D7 · Sin registro público, cuentas por semilla (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (10): 1. Base del proyecto, 2. Tema y UI base, 3. Estructura de carpetas, 4. Supabase local, 5. Arnés de pruebas, 6. OpenSpec, 7. Graphify, 8. Integración continua (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (10): 1. Base del proyecto, 2. Tema y UI base, 3. Estructura de carpetas, 4. Supabase local, 5. Arnés de pruebas, 6. OpenSpec, 7. Graphify, 8. Integración continua (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.2
Nodes (10): 8. Flujo de Usuario, Flujo A — Pedido de sublimación, de principio a fin, Flujo B — Pieza de alfarería, de la arcilla a la feria, Flujo C — Primeros encargos de 3D, Flujo D — Pedido de llaveros y falta de filamento, Flujo E — Día de feria, Flujo F — "Este número no cuadra", Flujo G — Recuperar algo archivado por error (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (8): 14. Próximos Pasos, 1. Resumen Ejecutivo, 4. Tipo de Producto Digital, 9. Necesidad de Datos y Persistencia, Consecuencias de diseño, Justificación, Kamay — Documento de Especificación de Producto, Reglas de datos que el negocio necesita

### Community 19 - "Community 19"
Cohesion: 0.22
Nodes (9): 16. Seguridad a nivel de fila (RLS), Bitácora: inalterable de verdad, Cómo se ocultan los costos al ayudante, code:sql (alter table orders enable row level security;), code:sql (create policy "tasks: ayudante ve su línea o lo asignado"), code:sql (alter table activity_log enable row level security;), Ejemplo de política más fina — tareas del ayudante, Matriz de acceso (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (8): Capabilities, Fuera de alcance, Impact, KAM-01 · Andamiaje del proyecto y disciplina de trabajo, Modified Capabilities, New Capabilities, What Changes, Why

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (8): 1. Base de datos: modelo de tenant, 2. Pruebas pgTAP (deltas `tenant-isolation`), 3. Clientes Supabase y middleware, 4. Pantallas de autenticación (V1), 5. Cascarón autenticado, 6. Pruebas e2e (delta `user-auth`), 7. Cierre, KAM-02 · Tareas

### Community 22 - "Community 22"
Cohesion: 0.22
Nodes (8): Capabilities, Fuera de alcance, Impact, KAM-02 · Autenticación, organizaciones y aislamiento, Modified Capabilities, New Capabilities, What Changes, Why

### Community 23 - "Community 23"
Cohesion: 0.22
Nodes (8): 1. Base de datos: modelo de tenant, 2. Pruebas pgTAP (deltas `tenant-isolation`), 3. Clientes Supabase y middleware, 4. Pantallas de autenticación (V1), 5. Cascarón autenticado, 6. Pruebas e2e (delta `user-auth`), 7. Cierre, KAM-02 · Tareas

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (8): Capabilities, Fuera de alcance, Impact, KAM-02 · Autenticación, organizaciones y aislamiento, Modified Capabilities, New Capabilities, What Changes, Why

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (8): Capabilities, Fuera de alcance, Impact, KAM-01 · Andamiaje del proyecto y disciplina de trabajo, Modified Capabilities, New Capabilities, What Changes, Why

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (8): 12. Alcance y Fases (Roadmap), Fase 0 — Cimientos *(no negociable, va primero)*, Fase 1 — MVP: el ciclo del dinero, Fase 2 — Tareas: el trabajo propio, Fase 3 — Inventario suave, activos y reportes, Fase 4 — Bitácora completa y tareas conectadas, Fase 5 — Precisión y producción, Fase 6 — Cara al cliente y expansión

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (7): 14. Bitácora de actividad, Agrupación de ruido, code:sql (create or replace function log_activity()), code:sql (create trigger audit after insert or update on orders), code:sql (-- Tarea programada mensual (pg_cron): exportar y luego resu), El trigger genérico, Retención

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (7): Context, Decisions, Design — KAM-01 · Andamiaje del proyecto, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 29 - "Community 29"
Cohesion: 0.25
Nodes (7): Context, Decisions, Design — KAM-01 · Andamiaje del proyecto, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, ThemeProvider()

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (7): 11. Consideraciones de Buenas Prácticas, Facilidad de uso, Mantenibilidad — la lección de la versión anterior, Notificaciones sin fatiga, Rendimiento, Seguridad y privacidad, SEO

### Community 32 - "Community 32"
Cohesion: 0.53
Nodes (4): isProtectedPath(), config, proxy(), updateSession()

### Community 33 - "Community 33"
Cohesion: 0.4
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

### Community 34 - "Community 34"
Cohesion: 0.4
Nodes (5): 10. Integraciones y Funcionalidades de Terceros, Deliberadamente evitado, Deseables después, Necesarias, Puerta de conexión con otras plataformas *(preparación futura)*

### Community 35 - "Community 35"
Cohesion: 0.4
Nodes (3): 9. Pedidos y ventas, Cobros y pagos, Una decisión que conviene revisar

### Community 36 - "Community 36"
Cohesion: 0.4
Nodes (4): 6. Configuración, code:sql (-- Líneas de negocio: Sublimación, Impresión 3D, Alfarería, ), code:sql (create or replace function resolve_statuses(org uuid, line u), Estados — la tabla que sostiene la flexibilidad

### Community 37 - "Community 37"
Cohesion: 0.4
Nodes (4): Convenciones no negociables, Kamay — Constitución del proyecto, Pruebas, Stack

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (4): 3.1 Dueño / administrador, 3.2 Ayudante / operador (1 o 2 personas), 3.3 Organizaciones futuras, 3. Público Objetivo

### Community 40 - "Community 40"
Cohesion: 0.5
Nodes (4): 13. Riesgos, Dudas y Decisiones Pendientes, Decisiones abiertas (no bloqueantes), Decisiones ya resueltas, Riesgos

### Community 41 - "Community 41"
Cohesion: 0.5
Nodes (4): 2. Objetivo del Negocio, Cómo se mide el éxito, Objetivo principal, Objetivos secundarios

### Community 42 - "Community 42"
Cohesion: 0.5
Nodes (4): 5. Propuesta de Valor y Tono de Marca, Diferenciadores frente a la versión anterior, Propuesta de valor interna, Tono y personalidad

### Community 43 - "Community 43"
Cohesion: 0.5
Nodes (4): 5. Identidad y multi-tenant, code:sql (-- Organizaciones (tenants)), code:sql (create or replace function is_member(org uuid)), Funciones auxiliares de seguridad

### Community 44 - "Community 44"
Cohesion: 0.5
Nodes (4): 18. Orden de migraciones, code:block25 (001_extensions_and_helpers    -- pgcrypto, is_member(), is_o), code:sql (-- Líneas), Semilla de Geeko Store

### Community 45 - "Community 45"
Cohesion: 0.5
Nodes (3): 13. Adjuntos, code:sql (create policy "storage: solo la propia organización"), Storage

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (3): 7. Directorio y catálogo, code:sql (-- Contactos: proveedores, clientes, o ambos), code:sql (-- Ítems: insumos, productos y activos en una sola tabla, di)

## Knowledge Gaps
- **363 isolated node(s):** `config`, `config`, `eslintConfig`, `nextConfig`, `geistSans` (+358 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Kamay — Documento de Especificación de Producto` connect `Community 18` to `Community 34`, `Community 4`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 9`, `Community 17`, `Community 26`, `Community 31`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `6. Funcionalidades Clave` connect `Community 4` to `Community 18`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `7. Mapa de Vistas / Pantallas` connect `Community 9` to `Community 18`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `config`, `config`, `eslintConfig` to the rest of the system?**
  _363 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._