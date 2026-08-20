# Graph Report - kamay-app  (2026-08-19)

## Corpus Check
- 32 files · ~58,294 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 443 nodes · 482 edges · 38 communities (32 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `526c621c`
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

## God Nodes (most connected - your core abstractions)
1. `7. Mapa de Vistas / Pantallas` - 24 edges
2. `Kamay — Esquema de Base de Datos (Supabase / PostgreSQL)` - 21 edges
3. `Kamay — Arquitectura del Proyecto` - 15 edges
4. `Kamay — Mapa de Interfaz y Navegación` - 15 edges
5. `Kamay — Documento de Especificación de Producto` - 15 edges
6. `8. Flujo de Usuario` - 10 edges
7. `Tasks — KAM-01 · Andamiaje del proyecto` - 10 edges
8. `7. Flujos principales, vista por vista` - 9 edges
9. `6. Funcionalidades Clave` - 9 edges
10. `FASE 1 · El ciclo del dinero` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Button()` --calls--> `cn()`  [EXTRACTED]
  components/ui/button.tsx → lib/utils.ts

## Communities (38 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (49): boot(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory(), createExternalModules() (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (37): 10. Inventario, 11. Vistas derivadas, 12. Tareas, 13. Adjuntos, 15. Notificaciones, 17. Sincronización sin conexión, 18. Orden de migraciones, 19. Lo que este esquema aún no incluye (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (34): Cómo usar este backlog, Convención de criterios de aceptación, Definición de terminado (aplica a todas las tareas), FASE 0 · Cimientos, FASE 1 · El ciclo del dinero, FASE 2 · Tareas, FASE 3 · Control y análisis, FASE 4 · Conexión y auditoría (+26 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (31): 6.1 Modelo conceptual — el contrato del sistema, 6.2 Estados y flujos de trabajo, 6.3 Módulo de Tareas, 6.4 Bitácora de actividad, 6.5 Archivado en lugar de eliminación *(decisión tomada)*, 6.6 Imprescindibles (núcleo), 6.7 Deseables (fases posteriores), 6.8 Fuera de alcance (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (29): Base de datos (migraciones), code:mermaid (flowchart LR), code:block2 (lint → typecheck → test:unit → supabase start → test:integra), code:block3 (openspec/), code:bash (pipx install graphifyy          # o: uv tool install graphif), code:bash (npm run dev              # desarrollo (puerto 3010)), Convenciones que conviene preservar, Datos de prueba (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (27): 10. Diferencias por rol, 11. Adaptación móvil por vista, 12. Estados transversales, 13. Diagrama para visualizar, 14. Lista de verificación de navegación, 1. Para qué sirve este documento, 2.1 El dispositivo define el punto de partida, 2.2 El selector de línea es contexto, no un filtro más (+19 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (24): 7. Mapa de Vistas / Pantallas, V10 · Catálogo, V11 · Detalle de ítem, V12 · Activos, V13 · Contactos, V14 · Reportes, V15 · Configuración de la organización, V16 · Registro rápido (móvil) (+16 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (22): ADDED Requirements, Purpose, Requirement: Application shell boots with theme switching, Requirement: Continuous integration enforces the pipeline, Requirement: Knowledge graph is versioned and self-updating, Requirement: Local Supabase environment is reproducible, Requirement: OpenSpec project conventions are recorded, Requirement: Quality gates run clean on the scaffold (+14 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (17): 7. Flujos principales, vista por vista, code:block10 (V15 → sección Estados → V22), code:block11 (V17 o V10 → casilla "Ver archivados" → desarchivar), code:block4 (V16 o V3 → V5 (nuevo pedido) → V4 (detalle)), code:block5 (V16 → V9 (gasto del stand, antes de salir)), code:block6 (V16 o V17 → V18 (tarea con lista de verificación de la horna), code:block7 (V2 (alerta de insumo bajo mínimo) → V11 (detalle del insumo)), code:block8 (V11 → pestaña Movimientos → V23 filtrada por ese ítem) (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (5): user, ThemeToggle(), cn(), Button(), buttonVariants

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (10): 1. Base del proyecto, 2. Tema y UI base, 3. Estructura de carpetas, 4. Supabase local, 5. Arnés de pruebas, 6. OpenSpec, 7. Graphify, 8. Integración continua (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.2
Nodes (10): 8. Flujo de Usuario, Flujo A — Pedido de sublimación, de principio a fin, Flujo B — Pieza de alfarería, de la arcilla a la feria, Flujo C — Primeros encargos de 3D, Flujo D — Pedido de llaveros y falta de filamento, Flujo E — Día de feria, Flujo F — "Este número no cuadra", Flujo G — Recuperar algo archivado por error (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (8): 14. Próximos Pasos, 1. Resumen Ejecutivo, 4. Tipo de Producto Digital, 9. Necesidad de Datos y Persistencia, Consecuencias de diseño, Justificación, Kamay — Documento de Especificación de Producto, Reglas de datos que el negocio necesita

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (9): 16. Seguridad a nivel de fila (RLS), Bitácora: inalterable de verdad, Cómo se ocultan los costos al ayudante, code:sql (alter table orders enable row level security;), code:sql (create policy "tasks: ayudante ve su línea o lo asignado"), code:sql (alter table activity_log enable row level security;), Ejemplo de política más fina — tareas del ayudante, Matriz de acceso (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (8): Capabilities, Fuera de alcance, Impact, KAM-01 · Andamiaje del proyecto y disciplina de trabajo, Modified Capabilities, New Capabilities, What Changes, Why

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (8): 12. Alcance y Fases (Roadmap), Fase 0 — Cimientos *(no negociable, va primero)*, Fase 1 — MVP: el ciclo del dinero, Fase 2 — Tareas: el trabajo propio, Fase 3 — Inventario suave, activos y reportes, Fase 4 — Bitácora completa y tareas conectadas, Fase 5 — Precisión y producción, Fase 6 — Cara al cliente y expansión

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (7): 14. Bitácora de actividad, Agrupación de ruido, code:sql (create or replace function log_activity()), code:sql (create trigger audit after insert or update on orders), code:sql (-- Tarea programada mensual (pg_cron): exportar y luego resu), El trigger genérico, Retención

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (7): Context, Decisions, Design — KAM-01 · Andamiaje del proyecto, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, ThemeProvider()

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (7): 11. Consideraciones de Buenas Prácticas, Facilidad de uso, Mantenibilidad — la lección de la versión anterior, Notificaciones sin fatiga, Rendimiento, Seguridad y privacidad, SEO

### Community 20 - "Community 20"
Cohesion: 0.4
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

### Community 21 - "Community 21"
Cohesion: 0.4
Nodes (5): 10. Integraciones y Funcionalidades de Terceros, Deliberadamente evitado, Deseables después, Necesarias, Puerta de conexión con otras plataformas *(preparación futura)*

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (4): Convenciones no negociables, Kamay — Constitución del proyecto, Pruebas, Stack

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (4): 2. Objetivo del Negocio, Cómo se mide el éxito, Objetivo principal, Objetivos secundarios

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (4): 5. Propuesta de Valor y Tono de Marca, Diferenciadores frente a la versión anterior, Propuesta de valor interna, Tono y personalidad

### Community 25 - "Community 25"
Cohesion: 0.5
Nodes (4): 13. Riesgos, Dudas y Decisiones Pendientes, Decisiones abiertas (no bloqueantes), Decisiones ya resueltas, Riesgos

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (4): 3.1 Dueño / administrador, 3.2 Ayudante / operador (1 o 2 personas), 3.3 Organizaciones futuras, 3. Público Objetivo

## Knowledge Gaps
- **244 isolated node(s):** `config`, `eslintConfig`, `nextConfig`, `geistSans`, `geistMono` (+239 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Kamay — Documento de Especificación de Producto` connect `Community 12` to `Community 3`, `Community 6`, `Community 11`, `Community 15`, `Community 19`, `Community 21`, `Community 23`, `Community 24`, `Community 25`, `Community 26`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `6. Funcionalidades Clave` connect `Community 3` to `Community 12`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `7. Mapa de Vistas / Pantallas` connect `Community 6` to `Community 12`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `config`, `eslintConfig`, `nextConfig` to the rest of the system?**
  _244 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._