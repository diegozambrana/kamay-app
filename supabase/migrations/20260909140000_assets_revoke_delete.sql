-- KAM-19 · Activos: revocar el borrado de `asset_details`.
-- Requisitos: openspec/changes/archive/2026-09-09-kam-19-assets-investment-recovery/
--   specs/assets/spec.md § Activos solo para la persona dueña → "Nada se borra".
--
-- Migración aparte y no una corrección de 20260908160000: una migración no se
-- edita nunca (convención nº 6), aunque todavía no esté fusionada — quien ya
-- haya aplicado aquella en su base local recibe esta encima y termina en el
-- mismo sitio.
--
-- ── Por qué hacía falta ───────────────────────────────────────────────────
-- `20260908160000` concedía `select, insert, update` y confiaba en la ausencia
-- de política `DELETE` para impedir el borrado. Eso basta solo si el
-- privilegio de borrar no está concedido por otra vía, y sí lo está: el
-- arranque de Supabase reparte privilegios sobre el esquema `public` a `anon`
-- y `authenticated`, de modo que la tabla nacía con `DELETE` y `TRUNCATE`
-- concedidos y frenados únicamente por RLS.
--
-- Ese reparto depende de la versión de la CLI: en local la tabla salía con
-- todos los privilegios y el borrado moría en la política ausente; en CI salía
-- sin ellos y moría en el privilegio. La misma prueba daba resultados
-- distintos según dónde corriera, que es exactamente lo que una garantía no
-- puede hacer.
--
-- Se hace explícito, como ya lo hacen `payments` (20260903180000) e
-- `inventory_movements` (20260908140000): el privilegio revocado, no solo la
-- política ausente. Archivar la máquina es archivar su ítem; borrarla no es
-- una operación que exista (convención nº 3).

revoke delete, truncate on asset_details from authenticated, anon, service_role;

-- `anon` no tiene nada que hacer aquí: el costo de la maquinaria es del dueño
-- autenticado (matriz de acceso §16).
revoke select, insert, update on asset_details from anon;

-- `service_role` lee para los trabajos programados, pero no escribe: los datos
-- de un activo los declara una persona.
revoke insert, update on asset_details from service_role;
