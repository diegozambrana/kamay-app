-- KAM-23 · Índice de tareas por línea (anexo de esquema §20).
--
-- La lista de verificación antes de producción pide que los índices cubran
-- los filtros reales de la interfaz: línea, estado, fecha de vencimiento y
-- cola. Pedidos, egresos e ítems tienen el suyo por línea desde que nacieron;
-- `tasks` no. El tablero y la lista de tareas filtran por la línea activa del
-- selector global y ordenan por creación (`TaskService.list()`), y hoy esa
-- consulta recorre el índice por estado y descarta a mano las de otras líneas.
--
-- Mismo criterio que el resto de índices de `tasks`: parcial sobre lo vigente,
-- porque lo archivado solo se lee a petición expresa.
create index tasks_organization_line_created_idx
  on tasks (organization_id, business_line_id, created_at desc)
  where archived_at is null;
