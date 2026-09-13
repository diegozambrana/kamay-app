-- KAM-23 · La lista de verificación antes de producción (anexo de esquema §20).
--
-- Los puntos del anexo que son propiedades del catálogo se comprueban aquí,
-- recorriendo `pg_class`, `pg_attribute`, `pg_trigger` y `pg_policies` en
-- lugar de enumerar tablas. La diferencia importa: una lista escrita a mano
-- aprueba hoy y se queda atrás mañana, cuando alguien añada la tabla número
-- veintinueve sin apuntarla. El catálogo la ve el mismo día.
--
-- Las exclusiones sí se enumeran —son pocas y cada una lleva su motivo—, de
-- modo que lo nuevo entra en la regla por defecto y salir de ella exige
-- escribir por qué.
--
-- `security_invoker` en las vistas vive en `views_security.test.sql`. El resto
-- de puntos del anexo, y dónde se verifica cada uno, está en
-- `docs/anexo-bd-verificacion.md`.
--
-- Escenarios del delta `tenant-isolation` → *The pre-production database
-- checklist is verified point by point*.
begin;

set search_path to public, extensions;

select plan(14);

create function pg_temp.login(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
end;
$$;

-- Las tablas de la aplicación. Una sola definición para todas las
-- comprobaciones, para que ninguna recorra un conjunto distinto.
create view pg_temp.app_tables as
  select c.oid, c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p');

-- ── Toda tabla con `organization_id` y RLS activo ─────────────────────────

select cmp_ok(
  (select count(*)::int from pg_temp.app_tables),
  '>=', 25,
  'catálogo: el recorrido encuentra las tablas de la aplicación');

-- `organizations` es la única excepción, y no por descuido: su propio `id` es
-- el identificador de organización que las demás referencian.
select is(
  (select coalesce(array_agg(t.relname order by t.relname), '{}')
     from pg_temp.app_tables t
    where t.relname <> 'organizations'
      and not exists (
        select 1 from pg_attribute a
         where a.attrelid = t.oid
           and a.attname = 'organization_id'
           and not a.attisdropped)),
  '{}'::name[],
  'anexo §20: toda tabla de datos tiene organization_id');

select is(
  (select coalesce(array_agg(t.relname order by t.relname), '{}')
     from pg_temp.app_tables t
    where not t.relrowsecurity),
  '{}'::name[],
  'anexo §20: toda tabla tiene RLS activo');

-- ── Ninguna política DELETE ───────────────────────────────────────────────

-- Ni `DELETE` ni `ALL` (que la incluye), en las tablas de la aplicación ni en
-- `storage.objects`: nada se borra, se archiva. `no_delete.test.sql` prueba el
-- comportamiento tabla por tabla; esto garantiza que ninguna tabla nueva nazca
-- con la política.
select is(
  (select coalesce(array_agg(schemaname || '.' || tablename || ': ' || policyname order by 1), '{}')
     from pg_policies
    where schemaname in ('public', 'storage')
      and cmd in ('DELETE', 'ALL')),
  '{}'::text[],
  'anexo §20: ninguna tabla tiene política DELETE');

-- ── Ni siquiera TRUNCATE ──────────────────────────────────────────────────

-- `TRUNCATE` no pasa por RLS: si un rol de la API lo conserva, vacía la tabla
-- de todas las organizaciones de una vez. Ninguno lo conserva, en ninguna
-- tabla (20260911091000_revoke_truncate.sql).
select is(
  (select coalesce(array_agg(r.rolname || ' → ' || t.relname order by 1), '{}')
     from pg_temp.app_tables t
     cross join (values ('anon'::name), ('authenticated'), ('service_role')) as r(rolname)
    where has_table_privilege(r.rolname, t.oid, 'TRUNCATE')),
  '{}'::text[],
  'anexo §20: ningún rol de la API puede hacer TRUNCATE sobre ninguna tabla');

-- Y las tablas que se creen después nacen igual. La tabla se crea dentro de
-- esta transacción y desaparece con ella.
create table public.kam23_future_table (id uuid primary key);

select ok(
  not has_table_privilege('authenticated', 'public.kam23_future_table', 'TRUNCATE'),
  'anexo §20: una tabla nueva nace sin TRUNCATE para los roles de la API');

drop table public.kam23_future_table;

-- ── Disparadores de auditoría en todas las tablas auditables ──────────────

-- Las que no se auditan, con su motivo:
--   · activity_log              — es la bitácora; auditarla sería recursivo.
--   · notifications,
--     notification_preferences  — un aviso no es un hecho del negocio sino una
--                                 consecuencia de otro que ya se registró
--                                 (migración de KAM-17).
--   · task_tags                 — tabla de unión sin `id`, que `log_activity()`
--                                 necesita como `record_id`; el canon §14 no la
--                                 incluye (migración de KAM-15).
select is(
  (select coalesce(array_agg(t.relname order by t.relname), '{}')
     from pg_temp.app_tables t
    where t.relname not in ('activity_log', 'notifications',
                            'notification_preferences', 'task_tags')
      and not exists (
        select 1 from pg_trigger g
         where g.tgrelid = t.oid
           and not g.tgisinternal
           and g.tgfoid = 'public.log_activity'::regproc)),
  '{}'::name[],
  'anexo §20: toda tabla auditable tiene el disparador de auditoría');

-- ── Importes en `numeric`, nunca en punto flotante ────────────────────────

-- Ninguna columna de ninguna tabla o vista usa un tipo de punto flotante ni
-- `money`: la regla se aplica a todo el esquema, no solo a lo que hoy se
-- llama importe.
select is(
  (select coalesce(array_agg(c.relname || '.' || a.attname order by 1), '{}')
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
      and a.attnum > 0 and not a.attisdropped
      and a.atttypid in ('real'::regtype, 'double precision'::regtype, 'money'::regtype)),
  '{}'::text[],
  'anexo §20: ninguna columna usa punto flotante ni money');

-- Y toda columna cuyo nombre dice importe es `numeric`.
select is(
  (select coalesce(array_agg(c.relname || '.' || a.attname order by 1), '{}')
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
      and a.attnum > 0 and not a.attisdropped
      and a.attname ~ '(amount|price|cost|total|balance|margin|outstanding|collected|paid)$'
      and a.attname not like '%\_id'
      and a.atttypid <> 'numeric'::regtype),
  '{}'::text[],
  'anexo §20: toda columna de importe es numeric');

-- ── Ningún valor derivable guardado en una columna ─────────────────────────

-- Los nombres que el anexo cita como ejemplo de dato derivado solo pueden
-- existir en las vistas, nunca en una tabla. El resto de la regla —que
-- ninguna columna guarde algo calculable— es un juicio sobre el significado
-- de cada columna y se verifica a mano en `docs/anexo-bd-verificacion.md`.
select is(
  (select coalesce(array_agg(t.relname || '.' || a.attname order by 1), '{}')
     from pg_temp.app_tables t
     join pg_attribute a on a.attrelid = t.oid
    where a.attnum > 0 and not a.attisdropped
      and a.attname in ('current_stock', 'stock', 'balance', 'total', 'last_cost',
                        'margin', 'outstanding', 'paid', 'collected')),
  '{}'::text[],
  'anexo §20: ninguna tabla guarda un valor derivado (stock, total, último costo, margen, saldo)');

-- ── Los filtros reales de la interfaz tienen índice ───────────────────────

-- Línea, estado, fecha de vencimiento y cola (la cola es un estado con
-- `is_queue`, así que la cubre el índice por estado). Esta sí es una lista:
-- lo que la interfaz filtra es una decisión de producto, no una propiedad del
-- catálogo. Cada par debe ser columna de algún índice de su tabla.
select is(
  (select coalesce(array_agg(f.tbl || '.' || f.col order by 1), '{}')
     from (values
       ('orders', 'business_line_id'), ('orders', 'status_id'), ('orders', 'due_date'),
       ('tasks', 'business_line_id'), ('tasks', 'status_id'), ('tasks', 'due_at'),
       ('expenses', 'business_line_id'), ('items', 'business_line_id'),
       ('activity_log', 'business_line_id')
     ) as f(tbl, col)
    where not exists (
      select 1
        from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
       where i.indrelid = ('public.' || f.tbl)::regclass
         and a.attname = f.col)),
  '{}'::text[],
  'anexo §20: línea, estado y vencimiento tienen índice en pedidos, tareas, egresos, ítems y bitácora');

-- ── Rutas de Storage alcanzadas por organización ──────────────────────────

-- Toda política de `storage.objects` decide por la primera carpeta de la ruta,
-- que es el `organization_id`.
select is(
  (select coalesce(array_agg(policyname order by policyname), '{}')
     from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and coalesce(qual, '') || coalesce(with_check, '') not like '%storage.foldername(name))[1]%'),
  '{}'::name[],
  'anexo §20: toda política de Storage verifica la carpeta de la organización');

-- Y el comportamiento: un objeto guardado bajo la carpeta de A no se alcanza
-- desde B en ningún bucket. `attachments_storage.test.sql` ya lo prueba a
-- fondo para `attachments`; aquí se recorren todos los buckets de una vez,
-- incluido el de las exportaciones de la purga.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000023c1', 'owner-chk-a@kamay.test'),
  ('00000000-0000-0000-0000-0000000023c2', 'owner-chk-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000023c', 'Checklist A'),
  ('00000000-0000-0000-0000-00000000023d', 'Checklist B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000023c', '00000000-0000-0000-0000-0000000023c1', 'owner'),
  ('00000000-0000-0000-0000-00000000023d', '00000000-0000-0000-0000-0000000023c2', 'owner');

insert into storage.objects (bucket_id, name)
  select b.id, '00000000-0000-0000-0000-00000000023c/kam23/archivo.bin'
    from storage.buckets b;

select pg_temp.login('00000000-0000-0000-0000-0000000023c2');

select is(
  (select coalesce(array_agg(distinct bucket_id order by bucket_id), '{}')
     from storage.objects
    where name like '00000000-0000-0000-0000-00000000023c/%'),
  '{}'::text[],
  'anexo §20: desde otra organización no se alcanza ningún objeto ajeno, en ningún bucket');

-- Que el recorrido anterior no apruebe por vacío: la dueña de A sí ve sus
-- objetos en los buckets de miembros.
select pg_temp.login('00000000-0000-0000-0000-0000000023c1');

select cmp_ok(
  (select count(distinct bucket_id)::int
     from storage.objects
    where name like '00000000-0000-0000-0000-00000000023c/%'),
  '>=', 4,
  'anexo §20: la organización dueña sí alcanza sus propios objetos');

select * from finish();
rollback;
