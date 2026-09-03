-- KAM-08 · Alta y edición de pedidos: las dos operaciones atómicas.
-- Escenarios del delta spec `orders` — requisitos "El alta es una sola
-- operación y el estado inicial lo asigna la base", "Edición de pedido",
-- "Las líneas de pedido se archivan, nunca se borran" y el requisito
-- modificado "El total del pedido se deriva, nunca se almacena".
--
-- Las funciones son `security invoker`, así que todo se ejerce desde un
-- usuario autenticado: llamarlas como `postgres` no probaría nada de lo que
-- importa.
begin;

set search_path to public, extensions;

select plan(48);

-- ── Helpers: simular usuarios autenticados ────────────────────────────────

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

-- ── Semilla propia (como postgres, sin RLS) ───────────────────────────────

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000801', 'owner-entry-a@kamay.test'),
  ('00000000-0000-0000-0000-000000000802', 'assistant-entry-a@kamay.test'),
  ('00000000-0000-0000-0000-000000000811', 'owner-entry-b@kamay.test');

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-00000000080a', 'Alta A'),
  ('00000000-0000-0000-0000-00000000080b', 'Alta B');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000080a', '00000000-0000-0000-0000-000000000801', 'owner'),
  ('00000000-0000-0000-0000-00000000080a', '00000000-0000-0000-0000-000000000802', 'assistant'),
  ('00000000-0000-0000-0000-00000000080b', '00000000-0000-0000-0000-000000000811', 'owner');

insert into business_lines (id, organization_id, name) values
  ('00000000-0000-0000-0000-00000000081a', '00000000-0000-0000-0000-00000000080a', 'Sublimación'),
  ('00000000-0000-0000-0000-00000000081b', '00000000-0000-0000-0000-00000000080b', 'Sublimación');

-- El estado inicial NO es el de menor identificador ni el primero insertado:
-- se declara en posición 2 para que la prueba distinga "resolver por kind y
-- position" de "tomar el primero que aparezca".
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('00000000-0000-0000-0000-000000000822', '00000000-0000-0000-0000-00000000080a', '00000000-0000-0000-0000-00000000081a', 'order', 'En proceso', 'in_progress', 1),
  ('00000000-0000-0000-0000-000000000821', '00000000-0000-0000-0000-00000000080a', '00000000-0000-0000-0000-00000000081a', 'order', 'Registrado', 'initial',     2),
  ('00000000-0000-0000-0000-000000000823', '00000000-0000-0000-0000-00000000080a', '00000000-0000-0000-0000-00000000081a', 'order', 'Entregado',  'final',       3),
  ('00000000-0000-0000-0000-000000000824', '00000000-0000-0000-0000-00000000080b', '00000000-0000-0000-0000-00000000081b', 'order', 'Registrado', 'initial',     1);

insert into contacts (id, organization_id, name, is_customer) values
  ('00000000-0000-0000-0000-000000000831', '00000000-0000-0000-0000-00000000080a', 'Cliente A', true),
  ('00000000-0000-0000-0000-000000000832', '00000000-0000-0000-0000-00000000080b', 'Cliente B', true);

-- El precio del catálogo es 999 a propósito: ninguna línea debe heredarlo.
insert into items (id, organization_id, business_line_id, kind, name, sale_price) values
  ('00000000-0000-0000-0000-000000000841', '00000000-0000-0000-0000-00000000080a',
   '00000000-0000-0000-0000-00000000081a', 'product', 'Taza', 999);

-- ══ create_order ══════════════════════════════════════════════════════════

select pg_temp.login('00000000-0000-0000-0000-000000000801');

-- ── Scenario: Nace en el estado inicial de su línea ───────────────────────

select is(
  create_order(
    jsonb_build_object(
      'id',               '00000000-0000-0000-0000-00000000a001',
      'organization_id',  '00000000-0000-0000-0000-00000000080a',
      'business_line_id', '00000000-0000-0000-0000-00000000081a',
      'contact_id',       '00000000-0000-0000-0000-000000000831',
      'notes',            'Primer pedido'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', '00000000-0000-0000-0000-00000000b001',
        'item_id', '00000000-0000-0000-0000-000000000841',
        'quantity', 3, 'unit_price', 45
      ),
      jsonb_build_object(
        'id', '00000000-0000-0000-0000-00000000b002',
        'description', 'La grande', 'quantity', 1, 'unit_price', 55
      )
    )
  ),
  '00000000-0000-0000-0000-00000000a001'::uuid,
  'create_order: devuelve el identificador que generó el cliente (convención nº 9)');

select is(
  (select status_id from orders where id = '00000000-0000-0000-0000-00000000a001'),
  '00000000-0000-0000-0000-000000000821'::uuid,
  'create_order: el pedido nace en el estado de tipo initial, no en el primero de la lista');

select is(
  (select s.kind from orders o join statuses s on s.id = o.status_id
    where o.id = '00000000-0000-0000-0000-00000000a001'),
  'initial', 'create_order: el estado asignado es de tipo initial');

select is(
  (select notes from orders where id = '00000000-0000-0000-0000-00000000a001'),
  'Primer pedido', 'create_order: guarda los datos opcionales que llegaron');

select is(
  (select count(*)::int from order_items
    where order_id = '00000000-0000-0000-0000-00000000a001'),
  2, 'create_order: guarda las dos líneas');

-- ── Scenario: El precio de la línea es el que se envió ────────────────────
-- El catálogo dice 999; la línea dice 45. La historia no se reescribe
-- (esquema §2).

select is(
  (select unit_price from order_items
    where id = '00000000-0000-0000-0000-00000000b001'),
  45::numeric(14,2),
  'create_order: la línea conserva su precio, no el del catálogo');

-- ── Scenario: El formulario no elige el estado ────────────────────────────
-- `status_id` en el jsonb se ignora: lo decide la base (D3).

-- El alta va en su propia sentencia: una función volátil llamada dentro del
-- `where` de la misma consulta escribe fuera de la instantánea que esa
-- consulta ya tomó, y la fila recién creada no sería visible.
select lives_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000a003',
         'organization_id',  '00000000-0000-0000-0000-00000000080a',
         'business_line_id', '00000000-0000-0000-0000-00000000081a',
         'contact_id',       '00000000-0000-0000-0000-000000000831',
         'status_id',        '00000000-0000-0000-0000-000000000823',
         'code',             9999),
       jsonb_build_array(jsonb_build_object('description', 'x', 'quantity', 1, 'unit_price', 10))) $$,
  'create_order: el alta se acepta aunque la entrada traiga status_id y code');

select is(
  (select s.kind from orders o join statuses s on s.id = o.status_id
    where o.id = '00000000-0000-0000-0000-00000000a003'),
  'initial', 'create_order: un status_id en la entrada no cambia el estado asignado');

select is(
  (select count(*)::int from orders
    where organization_id = '00000000-0000-0000-0000-00000000080a' and code = 9999),
  0, 'create_order: un code en la entrada no se respeta; lo asigna el trigger');

-- ── Scenario: Renombrar el estado inicial no cambia el comportamiento ─────
-- Convención nº 5: se compara por kind, jamás por nombre.

select pg_temp.logout();
update statuses set name = 'Anotado'
  where id = '00000000-0000-0000-0000-000000000821';
select pg_temp.login('00000000-0000-0000-0000-000000000801');

select lives_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000a004',
         'organization_id',  '00000000-0000-0000-0000-00000000080a',
         'business_line_id', '00000000-0000-0000-0000-00000000081a',
         'contact_id',       '00000000-0000-0000-0000-000000000831'),
       jsonb_build_array(jsonb_build_object('description', 'y', 'quantity', 1, 'unit_price', 10))) $$,
  'create_order: el alta se acepta con el estado inicial renombrado');

select is(
  (select s.kind from orders o join statuses s on s.id = o.status_id
    where o.id = '00000000-0000-0000-0000-00000000a004'),
  'initial', 'create_order: renombrar el estado inicial no cambia el resultado');

-- ── Scenario: La base rechaza el alta sin líneas ──────────────────────────

select throws_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000a0ff',
         'organization_id',  '00000000-0000-0000-0000-00000000080a',
         'business_line_id', '00000000-0000-0000-0000-00000000081a',
         'contact_id',       '00000000-0000-0000-0000-000000000831'),
       '[]'::jsonb) $$,
  '23514', 'Un pedido necesita al menos una línea',
  'create_order: sin líneas se rechaza con su mensaje');

select is(
  (select count(*)::int from orders where id = '00000000-0000-0000-0000-00000000a0ff'),
  0, 'create_order: el alta rechazada no dejó ningún pedido');

-- ── Scenario: Un fallo deja todo como estaba ──────────────────────────────
-- La segunda línea tiene cantidad 0: el `check` la rechaza y debe caerse el
-- pedido entero, no quedar a medias.

select throws_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000a0fe',
         'organization_id',  '00000000-0000-0000-0000-00000000080a',
         'business_line_id', '00000000-0000-0000-0000-00000000081a',
         'contact_id',       '00000000-0000-0000-0000-000000000831'),
       jsonb_build_array(
         jsonb_build_object('description', 'buena', 'quantity', 1, 'unit_price', 10),
         jsonb_build_object('description', 'mala',  'quantity', 0, 'unit_price', 10))) $$,
  '23514', null,
  'create_order: una línea inválida hace fallar el alta entera');

select is(
  (select count(*)::int from orders where id = '00000000-0000-0000-0000-00000000a0fe'),
  0, 'create_order: el alta fallida no dejó pedido');

select is(
  (select count(*)::int from order_items
    where organization_id = '00000000-0000-0000-0000-00000000080a'
      and description in ('buena', 'mala')),
  0, 'create_order: el alta fallida no dejó ninguna línea suelta');

-- El número no se consumió: el siguiente pedido toma el que tocaba. Tres
-- altas válidas van hasta ahora, así que la cuarta es la #4.
select lives_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000a005',
         'organization_id',  '00000000-0000-0000-0000-00000000080a',
         'business_line_id', '00000000-0000-0000-0000-00000000081a',
         'contact_id',       '00000000-0000-0000-0000-000000000831'),
       jsonb_build_array(jsonb_build_object('description', 'z', 'quantity', 1, 'unit_price', 10))) $$,
  'create_order: el alta siguiente a una fallida se acepta');

select is(
  (select code from orders where id = '00000000-0000-0000-0000-00000000a005'),
  4, 'create_order: un alta fallida no consume número de pedido');

-- ── Scenario: No perteneces a esa organización ────────────────────────────

select throws_ok(
  $$ select create_order(
       jsonb_build_object(
         'organization_id',  '00000000-0000-0000-0000-00000000080b',
         'business_line_id', '00000000-0000-0000-0000-00000000081b',
         'contact_id',       '00000000-0000-0000-0000-000000000832'),
       jsonb_build_array(jsonb_build_object('description', 'q', 'quantity', 1, 'unit_price', 10))) $$,
  '42501', 'No perteneces a esa organización',
  'create_order: el alta en una organización ajena se rechaza');

-- ── Scenario: El ayudante crea ────────────────────────────────────────────

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000802');

select lives_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000a002',
         'organization_id',  '00000000-0000-0000-0000-00000000080a',
         'business_line_id', '00000000-0000-0000-0000-00000000081a',
         'contact_id',       '00000000-0000-0000-0000-000000000831'),
       jsonb_build_array(jsonb_build_object('description', 'del ayudante', 'quantity', 2, 'unit_price', 20))) $$,
  'create_order: el ayudante crea pedidos');

select pg_temp.logout();

-- ── Scenario: Alta registrada en la bitácora ──────────────────────────────
-- Un solo historial (convención nº 7). Se lee como postgres porque la
-- bitácora solo es legible por el dueño.

select is(
  (select count(*)::int from activity_log
    where table_name = 'orders'
      and record_id = '00000000-0000-0000-0000-00000000a001'
      and action = 'created'),
  1, 'create_order: el alta deja un evento created del pedido');

select is(
  (select count(*)::int from activity_log
    where table_name = 'order_items'
      and record_id in ('00000000-0000-0000-0000-00000000b001',
                        '00000000-0000-0000-0000-00000000b002')
      and action = 'created'),
  2, 'create_order: cada línea deja su propio evento created');

-- ══ update_order ══════════════════════════════════════════════════════════

select pg_temp.login('00000000-0000-0000-0000-000000000801');

-- ── Scenario: Cambiar fecha y agregar una línea ───────────────────────────
-- Se envían las dos líneas existentes más una nueva.

select lives_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000a001',
         'organization_id',  '00000000-0000-0000-0000-00000000080a',
         'contact_id',       '00000000-0000-0000-0000-000000000831',
         'due_date',         '2026-12-24',
         'delivery_mode',    'delivery',
         'notes',            'Editado'),
       jsonb_build_array(
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b001',
                            'item_id', '00000000-0000-0000-0000-000000000841',
                            'quantity', 3, 'unit_price', 45),
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b002',
                            'description', 'La grande', 'quantity', 1, 'unit_price', 55),
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b003',
                            'description', 'Nueva', 'quantity', 2, 'unit_price', 60))) $$,
  'update_order: la edición se acepta');

select is(
  (select due_date from orders where id = '00000000-0000-0000-0000-00000000a001'),
  '2026-12-24'::date, 'update_order: la fecha comprometida cambió');

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-00000000a001'),
  310::numeric, 'update_order: el total refleja la línea nueva (135 + 55 + 120)');

-- ── Scenario: business_line_id y status_id no se tocan ────────────────────
-- Aunque vengan en el jsonb: cambiar la línea cambiaría el flujo del pedido.

select lives_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000a001',
         'organization_id',  '00000000-0000-0000-0000-00000000080a',
         'business_line_id', '00000000-0000-0000-0000-00000000081b',
         'status_id',        '00000000-0000-0000-0000-000000000823',
         'contact_id',       '00000000-0000-0000-0000-000000000831',
         'due_date',         '2026-12-24',
         'notes',            'Editado'),
       jsonb_build_array(
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b001',
                            'item_id', '00000000-0000-0000-0000-000000000841',
                            'quantity', 3, 'unit_price', 45),
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b002',
                            'description', 'La grande', 'quantity', 1, 'unit_price', 55),
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b003',
                            'description', 'Nueva', 'quantity', 2, 'unit_price', 60))) $$,
  'update_order: la edición con línea y estado en el jsonb se acepta');

select is(
  (select business_line_id from orders where id = '00000000-0000-0000-0000-00000000a001'),
  '00000000-0000-0000-0000-00000000081a'::uuid,
  'update_order: la línea de negocio no cambia aunque venga en el jsonb');

select is(
  (select status_id from orders where id = '00000000-0000-0000-0000-00000000a001'),
  '00000000-0000-0000-0000-000000000821'::uuid,
  'update_order: el estado no cambia aunque venga en el jsonb');

-- ── Scenario: Quitar fija la marca ────────────────────────────────────────
-- La línea b002 no viaja: se archiva, no se borra.

select lives_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',              '00000000-0000-0000-0000-00000000a001',
         'organization_id', '00000000-0000-0000-0000-00000000080a',
         'contact_id',      '00000000-0000-0000-0000-000000000831'),
       jsonb_build_array(
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b001',
                            'item_id', '00000000-0000-0000-0000-000000000841',
                            'quantity', 3, 'unit_price', 45))) $$,
  'update_order: quitar líneas se acepta');

select isnt(
  (select archived_at from order_items where id = '00000000-0000-0000-0000-00000000b002'),
  null::timestamptz, 'update_order: la línea ausente del payload queda archivada');

select is(
  (select count(*)::int from order_items
    where order_id = '00000000-0000-0000-0000-00000000a001'),
  3, 'update_order: la línea archivada sigue existiendo, no se borró');

-- ── Scenario: El total excluye las archivadas ─────────────────────────────
-- Queda vigente 3 × 45; archivadas 1 × 55 y 2 × 60.

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-00000000a001'),
  135::numeric, 'order_totals: el total excluye las líneas archivadas');

select pg_temp.logout();

select is(
  (select count(*)::int from activity_log
    where table_name = 'order_items'
      and record_id = '00000000-0000-0000-0000-00000000b002'
      and action = 'archived'),
  1, 'update_order: archivar la línea deja su evento archived en la bitácora');

select pg_temp.login('00000000-0000-0000-0000-000000000801');

-- ── Scenario: No se puede dejar sin líneas ────────────────────────────────

select throws_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',              '00000000-0000-0000-0000-00000000a001',
         'organization_id', '00000000-0000-0000-0000-00000000080a',
         'contact_id',      '00000000-0000-0000-0000-000000000831'),
       '[]'::jsonb) $$,
  '23514', 'Un pedido necesita al menos una línea',
  'update_order: dejar el pedido sin líneas se rechaza');

select is(
  (select count(*)::int from order_items
    where order_id = '00000000-0000-0000-0000-00000000a001' and archived_at is null),
  1, 'update_order: el rechazo dejó la línea vigente intacta');

-- ── Scenario: Un fallo deja el pedido como estaba ─────────────────────────

select throws_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',              '00000000-0000-0000-0000-00000000a001',
         'organization_id', '00000000-0000-0000-0000-00000000080a',
         'contact_id',      '00000000-0000-0000-0000-000000000831',
         'notes',           'no debe quedar'),
       jsonb_build_array(
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b001',
                            'item_id', '00000000-0000-0000-0000-000000000841',
                            'quantity', 3, 'unit_price', 45),
         jsonb_build_object('description', 'mala', 'quantity', 0, 'unit_price', 10))) $$,
  '23514', null,
  'update_order: una línea inválida hace fallar la edición entera');

select is(
  (select notes from orders where id = '00000000-0000-0000-0000-00000000a001'),
  null::text, 'update_order: la edición fallida no cambió el pedido');

-- ── Scenario: El ayudante edita ───────────────────────────────────────────

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000802');

select lives_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',              '00000000-0000-0000-0000-00000000a001',
         'organization_id', '00000000-0000-0000-0000-00000000080a',
         'contact_id',      '00000000-0000-0000-0000-000000000831',
         'notes',           'nota del ayudante'),
       jsonb_build_array(
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b001',
                            'item_id', '00000000-0000-0000-0000-000000000841',
                            'quantity', 4, 'unit_price', 45))) $$,
  'update_order: el ayudante edita el pedido y sus líneas');

-- ── Scenario: Miembro de otra organización ────────────────────────────────

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000811');

select throws_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',              '00000000-0000-0000-0000-00000000a001',
         'organization_id', '00000000-0000-0000-0000-00000000080a',
         'contact_id',      '00000000-0000-0000-0000-000000000831'),
       jsonb_build_array(
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b001',
                            'quantity', 1, 'unit_price', 45, 'description', 'x'))) $$,
  '42501', 'No perteneces a esa organización',
  'update_order: un miembro de otra organización no puede editar');

-- ── Scenario: El pedido archivado no se edita ─────────────────────────────

select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000801');

select lives_ok(
  $$ update orders set archived_at = now()
     where id = '00000000-0000-0000-0000-00000000a001' $$,
  'orders: el dueño archiva el pedido');

select throws_ok(
  $$ select update_order(
       jsonb_build_object(
         'id',              '00000000-0000-0000-0000-00000000a001',
         'organization_id', '00000000-0000-0000-0000-00000000080a',
         'contact_id',      '00000000-0000-0000-0000-000000000831',
         'notes',           'editando un archivado'),
       jsonb_build_array(
         jsonb_build_object('id', '00000000-0000-0000-0000-00000000b001',
                            'quantity', 1, 'unit_price', 45, 'description', 'x'))) $$,
  '23514', 'Un registro archivado no se puede editar: desarchívalo primero',
  'update_order: un pedido archivado rechaza la edición');

-- ══ Derivados y borrado ═══════════════════════════════════════════════════

-- ── Scenario: Total de un pedido con líneas ───────────────────────────────
-- 3 × 25 + 1 × 40 = 115, el caso del delta spec.

select lives_ok(
  $$ select create_order(
       jsonb_build_object(
         'id',               '00000000-0000-0000-0000-00000000a006',
         'organization_id',  '00000000-0000-0000-0000-00000000080a',
         'business_line_id', '00000000-0000-0000-0000-00000000081a',
         'contact_id',       '00000000-0000-0000-0000-000000000831'),
       jsonb_build_array(
         jsonb_build_object('description', 'a', 'quantity', 3, 'unit_price', 25),
         jsonb_build_object('description', 'b', 'quantity', 1, 'unit_price', 40))) $$,
  'create_order: alta de dos líneas para medir el total');

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-00000000a006'),
  115::numeric, 'order_totals: 3 × 25 + 1 × 40 son 115');

-- ── Scenario: Pedido sin líneas ───────────────────────────────────────────
-- `create_order` ya no permite crearlo, así que el caso se construye a mano:
-- la vista tiene que seguir devolviendo 0 y no nulo para los que existan.

select pg_temp.logout();

insert into orders (id, organization_id, business_line_id, kind, contact_id, status_id) values
  ('00000000-0000-0000-0000-00000000a0aa', '00000000-0000-0000-0000-00000000080a',
   '00000000-0000-0000-0000-00000000081a', 'order',
   '00000000-0000-0000-0000-000000000831', '00000000-0000-0000-0000-000000000821');

select is(
  (select total from order_totals where order_id = '00000000-0000-0000-0000-00000000a0aa'),
  0::numeric, 'order_totals: un pedido sin líneas da 0, no nulo');

-- ── Scenario: Nadie borra líneas ──────────────────────────────────────────

select pg_temp.login('00000000-0000-0000-0000-000000000801');

select throws_ok(
  $$ delete from order_items where id = '00000000-0000-0000-0000-00000000b002' $$,
  '42501', null, 'order_items: la línea archivada tampoco se puede borrar');

select pg_temp.logout();

select is(
  (select count(*)::int from order_items where id = '00000000-0000-0000-0000-00000000b002'),
  1, 'order_items: la línea sigue ahí tras el intento de borrado');

-- ── Scenario: Ninguna columna almacena el derivado ────────────────────────

select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and table_name in ('orders', 'order_items')
      and (column_name ~ '(total|cost|costo|margin|margen|balance|saldo|paid|pagado|cobrado)')),
  0, 'orders/order_items: ninguna columna de total, saldo, cobrado ni margen');

select is(
  (select reloptions::text from pg_class where relname = 'order_totals'),
  '{security_invoker=true}',
  'order_totals: la vista reemplazada conserva security_invoker');

select * from finish();
rollback;
