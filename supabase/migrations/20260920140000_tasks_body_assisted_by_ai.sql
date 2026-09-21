-- KAM-30 · Cambio `task-body-writing-assist` · Marca de "asistido" en el
-- cuerpo de la tarea.
--
-- No hace falta insertar nada a mano en `activity_log`: `tasks` ya lleva el
-- trigger `audit` desde su creación, y ese trigger diferencia toda columna que
-- cambie (supabase/README.md → "Cómo auditar una tabla nueva"). Una columna
-- real que el servidor pone en `true` cuando el cuerpo guardado proviene de
-- una propuesta aceptada, y en `false` en cualquier otro guardado, basta para
-- que el evento quede en la bitácora sin un segundo camino de escritura
-- (convención nº 7).

alter table tasks add column body_assisted_by_ai boolean not null default false;
