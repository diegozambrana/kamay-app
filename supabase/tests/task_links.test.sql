-- KAM-15 · task_links: el vínculo con el pedido, en su forma mínima.
-- Escenarios del delta spec `tasks` — requisito "El vínculo de una tarea con
-- un pedido se guarda desde el primer día".
--
-- En KAM-15 la única vía de escritura es *Crear tarea para este pedido* y el
-- único tipo escrito es `order`; el `check` admite los cinco del canon porque
-- la tabla se crea completa (design D1/D8), no porque haya interfaz para ellos.
begin;

set search_path to public, extensions;

select plan(10);

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

create function pg_temp.logout() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000015f0a1', 'owner-link@kamay.test'),
  ('00000000-0000-0000-0000-00000015f0a2', 'assist-link@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-0000000015fa', 'Vínculos');

insert into memberships (id, organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000015f1a1', '00000000-0000-0000-0000-0000000015fa', '00000000-0000-0000-0000-00000015f0a1', 'owner'),
  ('00000000-0000-0000-0000-00000015f1a2', '00000000-0000-0000-0000-0000000015fa', '00000000-0000-0000-0000-00000015f0a2', 'assistant');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000015f2a1', '00000000-0000-0000-0000-0000000015fa', 'Sublimación'),
  ('00000000-0000-0000-0000-00000015f2a2', '00000000-0000-0000-0000-0000000015fa', 'Alfarería');

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-00000015f3a1', '00000000-0000-0000-0000-0000000015fa', null, 'task',  'Por hacer',  'initial', 1),
  ('00000000-0000-0000-0000-00000015f3a2', '00000000-0000-0000-0000-0000000015fa', null, 'task',  'Hecho',      'final',   2),
  ('00000000-0000-0000-0000-00000015f3a3', '00000000-0000-0000-0000-0000000015fa', null, 'order', 'Registrado', 'initial', 1),
  ('00000000-0000-0000-0000-00000015f3a4', '00000000-0000-0000-0000-0000000015fa', null, 'order', 'Entregado',  'final',   2);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-00000015f4a1', '00000000-0000-0000-0000-0000000015fa', 'Cliente', true);

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000015f5a1', '00000000-0000-0000-0000-0000000015fa',
   '00000000-0000-0000-0000-00000015f2a1', 'order',
   '00000000-0000-0000-0000-00000015f4a1', '00000000-0000-0000-0000-00000015f3a3');

-- KAM-19: un ítem de tipo activo con sus datos, para el destino `asset`.
insert into items (id, organization_id, business_line_id, kind, name) values
  ('00000000-0000-0000-0000-00000015f7a1', '00000000-0000-0000-0000-0000000015fa',
   '00000000-0000-0000-0000-00000015f2a1', 'asset', 'Impresora 3D');

insert into asset_details (item_id, organization_id, acquisition_cost, acquired_on) values
  ('00000000-0000-0000-0000-00000015f7a1', '00000000-0000-0000-0000-0000000015fa',
   7000, date '2026-01-15');

insert into tasks (id, organization_id, business_line_id, title) values
  ('00000000-0000-0000-0000-00000015f6a1', '00000000-0000-0000-0000-0000000015fa',
   '00000000-0000-0000-0000-00000015f2a1', 'Diseñar arte del pedido'),
  -- De Alfarería: sirve para comprobar que el vínculo sigue a su tarea.
  ('00000000-0000-0000-0000-00000015f6a2', '00000000-0000-0000-0000-0000000015fa',
   '00000000-0000-0000-0000-00000015f2a2', 'Tarea de otra línea');

-- ── El vínculo al pedido se guarda ────────────────────────────────────────

select lives_ok(
  $$ insert into task_links (task_id, organization_id, entity_type, entity_id)
     values ('00000000-0000-0000-0000-00000015f6a1',
             '00000000-0000-0000-0000-0000000015fa', 'order',
             '00000000-0000-0000-0000-00000015f5a1') $$,
  'task_links: el vínculo a un pedido existente se guarda');

-- ── Scenario: Vínculo a un registro inexistente ───────────────────────────

select throws_ok(
  $$ insert into task_links (task_id, organization_id, entity_type, entity_id)
     values ('00000000-0000-0000-0000-00000015f6a1',
             '00000000-0000-0000-0000-0000000015fa', 'order',
             '00000000-0000-0000-0000-0000000000ff') $$,
  '23503', null, 'task_links: un pedido inexistente se rechaza');

select throws_ok(
  $$ insert into task_links (task_id, organization_id, entity_type, entity_id)
     values ('00000000-0000-0000-0000-00000015f6a1',
             '00000000-0000-0000-0000-0000000015fa', 'contact',
             '00000000-0000-0000-0000-0000000000ff') $$,
  '23503', null, 'task_links: un contacto inexistente también se rechaza');

-- ── Scenario: Vínculo duplicado ───────────────────────────────────────────

select throws_ok(
  $$ insert into task_links (task_id, organization_id, entity_type, entity_id)
     values ('00000000-0000-0000-0000-00000015f6a1',
             '00000000-0000-0000-0000-0000000015fa', 'order',
             '00000000-0000-0000-0000-00000015f5a1') $$,
  '23505', null, 'task_links: el mismo pedido no se vincula dos veces a la misma tarea');

-- Acotado a esta tarea: la base local comparte datos con las pruebas de
-- extremo a extremo, y un `count(*)` global contaría los vínculos que aquellas
-- hayan dejado.
select is(
  (select count(*)::int from task_links
   where task_id = '00000000-0000-0000-0000-00000015f6a1'),
  1, 'task_links: solo queda un vínculo en esta tarea');

-- Un tipo fuera del dominio no entra, aunque su interfaz llegue en KAM-21.
select throws_ok(
  $$ insert into task_links (task_id, organization_id, entity_type, entity_id)
     values ('00000000-0000-0000-0000-00000015f6a1',
             '00000000-0000-0000-0000-0000000015fa', 'invoice',
             '00000000-0000-0000-0000-00000015f5a1') $$,
  '23514', null, 'task_links: un entity_type fuera del canon se rechaza');

-- ── Scenario: El vínculo sigue la visibilidad de su tarea ─────────────────
-- El ayudante queda restringido a Alfarería: no ve la tarea de Sublimación,
-- así que tampoco su vínculo.

insert into membership_lines (membership_id, business_line_id, organization_id) values
  ('00000000-0000-0000-0000-00000015f1a2', '00000000-0000-0000-0000-00000015f2a2',
   '00000000-0000-0000-0000-0000000015fa');

select pg_temp.login('00000000-0000-0000-0000-00000015f0a2');

select is(
  (select count(*)::int from task_links
   where organization_id = '00000000-0000-0000-0000-0000000015fa'),
  0, 'task_links: el ayudante no ve el vínculo de una tarea que no ve');

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000015f0a1');

select is(
  (select count(*)::int from task_links
   where organization_id = '00000000-0000-0000-0000-0000000015fa'),
  1, 'task_links: la persona dueña sí lo ve');

select pg_temp.logout();

-- ── Scenario: Vínculo a un activo existente / inexistente (KAM-19) ───────
-- Hasta KAM-19 el trigger rechazaba todo vínculo `asset`: no había a qué
-- apuntar. Ahora valida contra `asset_details`. La interfaz que crea estos
-- vínculos sigue siendo de KAM-21; lo que se comprueba aquí es la validación.

select lives_ok(
  $$ insert into task_links (task_id, organization_id, entity_type, entity_id)
     values ('00000000-0000-0000-0000-00000015f6a2',
             '00000000-0000-0000-0000-0000000015fa', 'asset',
             '00000000-0000-0000-0000-00000015f7a1') $$,
  'task_links: el vínculo a un activo existente se guarda');

select throws_ok(
  $$ insert into task_links (task_id, organization_id, entity_type, entity_id)
     values ('00000000-0000-0000-0000-00000015f6a2',
             '00000000-0000-0000-0000-0000000015fa', 'asset',
             '00000000-0000-0000-0000-0000000000ff') $$,
  '23503', null, 'task_links: un activo inexistente se rechaza');

select * from finish();
rollback;
