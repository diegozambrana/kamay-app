-- KAM-20 · El reparto de gastos compartidos no toca la base.
-- Escenarios del delta spec `shared-expense-allocation` § El reparto se
--   aplica en la lectura y jamás reescribe el egreso: "El egreso no se mueve
--   de línea", "El reparto no crea filas nuevas".
--
-- La aritmética del reparto vive en `lib/reports/allocation.ts` y se prueba
-- allí (design D4). Lo que se prueba AQUÍ es lo que solo la base puede
-- afirmar: que leer el comparativo no escribe nada.
begin;

set search_path to public, extensions;

select plan(5);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000024a1', 'owner-alloc@kamay.test');

insert into organizations (id, name, timezone) values
  ('00000000-0000-0000-0000-0000000024b0', 'Reparto A', 'America/La_Paz');

insert into memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000024b0', '00000000-0000-0000-0000-0000000024a1', 'owner');

insert into business_lines (id, organization_id, name, position, is_shared) values
  ('00000000-0000-0000-0000-0000000024c1', '00000000-0000-0000-0000-0000000024b0', 'Sublimación', 1, false),
  ('00000000-0000-0000-0000-0000000024c2', '00000000-0000-0000-0000-0000000024b0', 'Alfarería',   2, false),
  ('00000000-0000-0000-0000-0000000024c0', '00000000-0000-0000-0000-0000000024b0', 'General',     3, true);

insert into expense_categories (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000024e1', '00000000-0000-0000-0000-0000000024b0', 'Servicios');

-- 300 de gasto en la línea compartida: es lo que el reparto distribuye.
insert into expenses (id, organization_id, business_line_id, kind, expense_category_id, amount, occurred_at) values
  ('00000000-0000-0000-0000-000000024201', '00000000-0000-0000-0000-0000000024b0',
   '00000000-0000-0000-0000-0000000024c0', 'expense',
   '00000000-0000-0000-0000-0000000024e1', 300.00, '2026-03-10 12:00:00-04');

select pg_temp.login('00000000-0000-0000-0000-0000000024a1');

-- ── La función entrega la línea compartida identificable, sin repartir ────

select is(
  (select is_shared from report_line_comparison(
     '00000000-0000-0000-0000-0000000024b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')
   where business_line_id = '00000000-0000-0000-0000-0000000024c0'),
  true,
  'La línea compartida llega marcada, para que el reparto sepa cuál es'
);

select is(
  (select count(*) from report_line_comparison(
     '00000000-0000-0000-0000-0000000024b0',
     '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04')),
  3::bigint,
  'Toda línea no archivada devuelve fila, tenga o no movimiento'
);

-- ── El reparto no crea filas nuevas ───────────────────────────────────────
-- Leer el comparativo, con las mismas lecturas que hace la pantalla, y
-- comprobar que `expenses` tiene exactamente las filas que tenía.

create temp table before_count as
  select count(*) as n from expenses
  where organization_id = '00000000-0000-0000-0000-0000000024b0';

-- La lectura completa del informe, tal como la hace la pantalla.
create temp table read_result as
  select * from report_line_comparison(
    '00000000-0000-0000-0000-0000000024b0',
    '2026-03-01 00:00:00-04', '2026-04-01 00:00:00-04');

select is(
  (select count(*) from expenses
   where organization_id = '00000000-0000-0000-0000-0000000024b0'),
  (select n from before_count),
  'Leer el comparativo no añade ni quita filas de expenses'
);

-- ── El egreso no se mueve de línea ────────────────────────────────────────
-- Sigue perteneciendo a General después de que el informe lo reparta.

select is(
  (select business_line_id from expenses
   where id = '00000000-0000-0000-0000-000000024201'),
  '00000000-0000-0000-0000-0000000024c0'::uuid,
  'El gasto sigue en la línea compartida tras leer el informe'
);

select is(
  (select et.business_line_id from expense_totals et
   where et.expense_id = '00000000-0000-0000-0000-000000024201'),
  '00000000-0000-0000-0000-0000000024c0'::uuid,
  'expense_totals lo sigue devolviendo con la línea compartida'
);

select * from finish();
rollback;
