-- Semilla de desarrollo y pruebas (solo entorno local).
-- Usuarios: contraseña "kamay123" para todos.
--   owner@kamay.test    → dueño de "Taller Kamay" (una sola organización)
--   multi@kamay.test    → dueño de "Taller Kamay" y "Kamay Feria" (dos organizaciones)
--   recovery@kamay.test → ayudante de "Taller Kamay" (para la prueba de recuperación)

--   geeko@kamay.test    → dueña de "Geeko Store" (la organización real, con su configuración)
--   ayudante@kamay.test → ayudante de "Geeko Store"
--   historico@kamay.test → dueño de "Kamay Histórico", doce meses de movimientos
--                          para medir el presupuesto de carga del panel (KAM-14)
--   superadmin@kamay.test → administrador de la plataforma, sin ninguna membresía
--                           (KAM-26): ve y administra todas las organizaciones

-- Organizaciones
insert into organizations (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Taller Kamay'),
  ('10000000-0000-0000-0000-000000000002', 'Kamay Feria'),
  ('10000000-0000-0000-0000-000000000003', 'Geeko Store'),
  -- Organización aparte y a propósito (KAM-14): los doce meses de historia que
  -- el presupuesto de carga necesita no pueden vivir en Geeko Store, cuyas
  -- filas son fixtures de las pruebas de tablero, alta y feria —36 pedidos más
  -- les cambiarían las columnas, las listas y la cuadrícula bajo los pies—.
  ('10000000-0000-0000-0000-000000000004', 'Kamay Histórico');

-- Usuarios de Supabase Auth
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- GoTrue lee estas columnas como texto: NULL rompe el inicio de sesión.
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('kamay123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(),
  '', '', '', '', ''
from (values
  ('20000000-0000-0000-0000-000000000001'::uuid, 'owner@kamay.test'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'multi@kamay.test'),
  ('20000000-0000-0000-0000-000000000003'::uuid, 'recovery@kamay.test'),
  ('20000000-0000-0000-0000-000000000004'::uuid, 'geeko@kamay.test'),
  ('20000000-0000-0000-0000-000000000005'::uuid, 'ayudante@kamay.test'),
  ('20000000-0000-0000-0000-000000000006'::uuid, 'historico@kamay.test'),
  -- El 0007 lo usa `seeds/performance.sql` (rendimiento@).
  ('20000000-0000-0000-0000-000000000008'::uuid, 'superadmin@kamay.test')
) as u(id, email);

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', u.id::text,
  now(), now(), now()
from auth.users u
where u.email like '%@kamay.test';

-- Membresías
insert into memberships (organization_id, user_id, role, display_name) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner', 'Dueña Taller'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'owner', 'Multi Org'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'owner', 'Multi Org'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'assistant', 'Ayudante Recuperación'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 'owner', 'Dueña Geeko'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', 'assistant', 'Ayudante Geeko'),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000006', 'owner', 'Dueño Histórico');

-- Administrador de la plataforma (KAM-26): ninguna membresía, a propósito. Que
-- exista en la semilla hace que toda la suite pgTAP y de integración corra con
-- un super admin presente, y así "el aislamiento de siempre sigue valiendo" se
-- prueba solo.
insert into platform_admins (user_id, note) values
  ('20000000-0000-0000-0000-000000000008', 'Semilla de desarrollo');

-- ── Geeko Store: la configuración real del negocio ─────────────────────────
-- Vive en una función y no suelta: la suite de extremo a extremo necesita una
-- **copia propia por prueba** (KAM-23, `project-foundation` → *Tests do not
-- interfere with each other*), y la copia tiene que ser la misma semilla, no
-- una segunda que se desvíe con el tiempo. `e2e.seed_geeko(p_org)` siembra la
-- configuración, el catálogo, los pedidos, los egresos, el inventario y los
-- cobros de Geeko en la organización que se le pase:
--
--   · para Geeko Store (`…-0003`) con **los mismos identificadores de siempre**
--     —`e2e.gid()` los devuelve tal cual—, así que `seed_geeko.test.sql` y
--     todo lo que los nombra sigue igual;
--   · para una copia, con identificadores derivados de la organización nueva,
--     de modo que las referencias entre filas se conservan.
--
-- `e2e.clone_geeko()` crea la organización, su dueña y su ayudante, y la
-- siembra. Lo llama `tests/e2e/helpers/geeko.ts` por `psql`.
--
-- El esquema `e2e` solo existe donde se aplica esta semilla —local y CI—, la
-- API no lo expone y ningún rol de la aplicación puede usarlo.

create schema e2e;
revoke all on schema e2e from public;

-- El identificador de una fila sembrada en la organización `p_org`: el de
-- siempre para las organizaciones de la semilla —Geeko Store, Kamay Histórico
-- y Kamay Rendimiento (seeds/performance.sql)—, uno derivado para una copia.
create function e2e.gid(p_org uuid, p_id uuid) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when p_org in (
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000005'
    ) then p_id
    else md5(p_org::text || p_id::text)::uuid
  end
$$;

-- Una usuaria de Auth con la contraseña común de desarrollo, como las de
-- arriba: las copias entran igual que las organizaciones de la semilla.
create function e2e.create_user(p_id uuid, p_email text) returns void
language sql set search_path = public, extensions as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    crypt('kamay123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', ''
  );
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', p_id::text, now(), now(), now()
  );
$$;

create function e2e.seed_geeko(p_org uuid) returns void
language plpgsql set search_path = public, extensions as $geeko$
begin
  -- ── Geeko Store: la configuración real del negocio ────────────────────────
  -- Tres líneas productivas más General/Compartido, que es donde caen los
  -- registros que no pertenecen a una sola línea (esquema §18, semilla).

  insert into business_lines (id, organization_id, name, color, is_shared, position) values
    (e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), p_org, 'Sublimación',  'blue',   false, 1),
    (e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), p_org, 'Impresión 3D', 'violet', false, 2),
    (e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), p_org, 'Alfarería',    'orange', false, 3),
    (e2e.gid(p_org, '30000000-0000-0000-0000-000000000004'), p_org, 'General',      'zinc',   true,  4);

  insert into sales_channels (id, organization_id, name, position) values
    (e2e.gid(p_org, '40000000-0000-0000-0000-000000000001'), p_org, 'Feria',          1),
    (e2e.gid(p_org, '40000000-0000-0000-0000-000000000002'), p_org, 'Redes',          2),
    (e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'), p_org, 'Pedido directo', 3),
    (e2e.gid(p_org, '40000000-0000-0000-0000-000000000004'), p_org, 'Mostrador',      4);

  -- Juego mínimo para poder registrar egresos e ítems desde el primer día.
  insert into expense_categories (id, organization_id, name) values
    (e2e.gid(p_org, '50000000-0000-0000-0000-000000000001'), p_org, 'Insumos'),
    (e2e.gid(p_org, '50000000-0000-0000-0000-000000000002'), p_org, 'Servicios'),
    (e2e.gid(p_org, '50000000-0000-0000-0000-000000000003'), p_org, 'Transporte'),
    (e2e.gid(p_org, '50000000-0000-0000-0000-000000000004'), p_org, 'Herramientas');

  insert into units (id, organization_id, code, name) values
    (e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), p_org, 'u',  'Unidad'),
    (e2e.gid(p_org, '60000000-0000-0000-0000-000000000002'), p_org, 'kg', 'Kilogramo'),
    (e2e.gid(p_org, '60000000-0000-0000-0000-000000000003'), p_org, 'm',  'Metro'),
    (e2e.gid(p_org, '60000000-0000-0000-0000-000000000004'), p_org, 'l',  'Litro');

  -- ── Estados (KAM-05, esquema § Semilla) ───────────────────────────────────
  -- Tareas: un solo juego de organización sirve a las tres líneas.
  -- Pedidos: cada línea productiva trae el suyo; no hay juego de organización.

  insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000001'), p_org, null, 'task', 'Por hacer',   'initial',     1),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000002'), p_org, null, 'task', 'Haciendo',    'in_progress', 2),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000003'), p_org, null, 'task', 'En revisión', 'waiting',     3),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000004'), p_org, null, 'task', 'Hecho',       'final',       4);

  -- Sublimación: los seis definidos, más Cancelado. "En cola" es la única
  -- columna con is_queue: se ordena por antigüedad, no por urgencia.
  insert into statuses (id, organization_id, business_line_id, flow, name, kind, is_queue, position) values
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000011'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 'Registrado',         'initial',     false, 1),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000012'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 'En diseño',          'in_progress', false, 2),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000013'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 'En cola',            'waiting',     true,  3),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000014'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 'Sublimando',         'in_progress', false, 4),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000015'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 'Listo para entrega', 'waiting',     false, 5),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000016'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 'Entregado',          'final',       false, 6),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000017'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 'Cancelado',          'cancelled',   false, 7);

  -- Alfarería: juego mínimo, casi todo se vende como venta directa.
  insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000021'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'order', 'Reservado',          'initial',   1),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000022'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'order', 'Listo para entrega', 'waiting',   2),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000023'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'order', 'Entregado',          'final',     3),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000024'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'order', 'Cancelado',          'cancelled', 4);

  -- Impresión 3D: juego provisional (sublimación sin diseño), a confirmar con
  -- los primeros 10 encargos reales.
  insert into statuses (id, organization_id, business_line_id, flow, name, kind, is_queue, position) values
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000031'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'order', 'Registrado',         'initial',     false, 1),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000032'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'order', 'En cola',            'waiting',     true,  2),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000033'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'order', 'Imprimiendo',        'in_progress', false, 3),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000034'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'order', 'Post-proceso',       'in_progress', false, 4),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000035'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'order', 'Listo para entrega', 'waiting',     false, 5),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000036'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'order', 'Entregado',          'final',       false, 6),
    (e2e.gid(p_org, '70000000-0000-0000-0000-000000000037'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'order', 'Cancelado',          'cancelled',   false, 7);

  -- ── Catálogo y directorio (KAM-06) ────────────────────────────────────────
  -- Lo mínimo para ejercitar V10, V11 y V13 sin capturar nada a mano: los tres
  -- tipos de ítem, uno compartido entre líneas, uno con variantes, y los tres
  -- casos de rol de contacto. "Taza para sublimación" lleva tilde a propósito:
  -- es el caso de la búsqueda tolerante a acentos.

  insert into contacts (id, organization_id, name, phone, email, is_supplier, is_customer, notes) values
    (e2e.gid(p_org, '80000000-0000-0000-0000-000000000001'), p_org, 'Distribuidora Andina',  '+591 70000001', 'ventas@andina.test',  true,  false, 'Tazas y planchas, entrega en 3 días.'),
    (e2e.gid(p_org, '80000000-0000-0000-0000-000000000002'), p_org, 'María Céspedes',        '+591 70000002', null,                  false, true,  'Compra recuerdos para cumpleaños.'),
    (e2e.gid(p_org, '80000000-0000-0000-0000-000000000003'), p_org, 'Taller Ñawi',           '+591 70000003', 'hola@nawi.test',      true,  true,  'Nos compra filamento y nos vende arcilla.'),
    (e2e.gid(p_org, '80000000-0000-0000-0000-000000000004'), p_org, 'Colegio San Andrés',    '+591 70000004', null,                  false, true,  'Pedidos grandes en septiembre.');

  -- Categorías de ítem, una lista por tipo (cambio `item-categories`).
  -- «Embalaje» existe como insumo y como producto: la unicidad es por tipo.
  insert into item_categories (id, organization_id, kind, name) values
    (e2e.gid(p_org, '92000000-0000-0000-0000-000000000001'), p_org, 'supply', 'Sustratos'),
    (e2e.gid(p_org, '92000000-0000-0000-0000-000000000002'), p_org, 'supply', 'Materia prima'),
    (e2e.gid(p_org, '92000000-0000-0000-0000-000000000003'), p_org, 'supply', 'Embalaje'),
    (e2e.gid(p_org, '92000000-0000-0000-0000-000000000004'), p_org, 'supply', 'Filamento'),
    (e2e.gid(p_org, '92000000-0000-0000-0000-000000000011'), p_org, 'product', 'Regalos'),
    (e2e.gid(p_org, '92000000-0000-0000-0000-000000000012'), p_org, 'product', 'Decoración'),
    (e2e.gid(p_org, '92000000-0000-0000-0000-000000000013'), p_org, 'product', 'Vajilla'),
    (e2e.gid(p_org, '92000000-0000-0000-0000-000000000014'), p_org, 'product', 'Embalaje');

  -- Insumos: los dos primeros de Sublimación, el tercero de Alfarería.
  insert into items (id, organization_id, business_line_id, kind, name, description, unit_id, category_id, sale_price, min_stock) values
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000001'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'supply', 'Taza para sublimación',  'Taza blanca con recubrimiento.',     e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000001'), null,  12),
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000002'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'supply', 'Papel de transferencia', 'Resma A4 para sublimación.',         e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000001'), null, 100),
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000003'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'supply', 'Arcilla roja',           'Arcilla local, saco de 25 kg.',      e2e.gid(p_org, '60000000-0000-0000-0000-000000000002'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000002'), null, 25),
    -- Compartido: la caja sirve a las tres líneas, así que no tiene línea.
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000004'), p_org, null,                                   'supply', 'Caja de cartón',         'Embalaje para entregas.',            e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000003'),  null,  40);

  -- Productos: el primero es el que tiene variantes.
  insert into items (id, organization_id, business_line_id, kind, name, description, unit_id, category_id, sale_price) values
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'product', 'Taza personalizada', 'Taza sublimada con diseño del cliente.', e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000011'),    45),
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000012'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'product', 'Maceta de barro',    'Torneada a mano.',                       e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000012'), 60),
    -- Alfarería vende casi todo como venta directa (KAM-12), así que su
    -- catálogo vendible es lo que llena la cuadrícula del modo feria.
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000013'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'product', 'Taza de barro',      'Torneada a mano, esmalte mate.',         e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000013'),    35),
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000014'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'product', 'Plato hondo',        'Juego de mesa, pieza suelta.',           e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000013'),    28),
    -- Compartido: se vende en cualquier línea, así que la cuadrícula lo ofrece
    -- esté en la feria que esté.
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000015'), p_org, null,                                   'product', 'Bolsa de regalo',    'Papel kraft con asa.',                   e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000014'),    5),
    -- Sin precio de venta a propósito: no se puede vender en dos toques, así
    -- que la cuadrícula del modo feria NO debe ofrecerlo.
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000016'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'product', 'Jarrón grande',      'Pieza única; se cotiza cada una.',       e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000012'), null);

  -- Activos: los datos de costo y recuperación llegan con KAM-19.
  insert into items (id, organization_id, business_line_id, kind, name, description, unit_id) values
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000021'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'asset', 'Prensa de tazas',   'Prensa térmica de 6 tazas.', e2e.gid(p_org, '60000000-0000-0000-0000-000000000001')),
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000022'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'asset', 'Impresora 3D Ender', 'Compra 2025, en uso diario.', e2e.gid(p_org, '60000000-0000-0000-0000-000000000001'));

  -- Las tazas no tienen atributos declarados: el nombre de la variante ya
  -- dice la capacidad. La clave antigua `capacidad` se quitó con
  -- `catalog-custom-attributes`, que guarda los valores por id de atributo.
  insert into item_variants (id, organization_id, item_id, name, sale_price) values
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000001'), p_org, e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), '11oz', 45),
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000002'), p_org, e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), '15oz', 55);

  -- ── Filamento: atributos por categoría (catalog-custom-attributes) ──────
  -- La categoría declara sus atributos una vez: marca, temperaturas y
  -- velocidad describen al ítem (dependen de la marca, no del color); el
  -- color describe a la variante. «PLA Sunlu» es el ítem y cada color una
  -- variante. Los valores se guardan con el id del atributo como clave.
  -- Sin compras sembradas: las pruebas que miden saldos crean las suyas.
  insert into item_category_attributes (id, organization_id, category_id, name, type, unit, options, required, scope, position) values
    (e2e.gid(p_org, '93000000-0000-0000-0000-000000000001'), p_org, e2e.gid(p_org, '92000000-0000-0000-0000-000000000004'), 'Marca',                 'list',   null,   '["Sunlu","eSun","Creality"]'::jsonb,      false, 'item',    1),
    (e2e.gid(p_org, '93000000-0000-0000-0000-000000000002'), p_org, e2e.gid(p_org, '92000000-0000-0000-0000-000000000004'), 'Temperatura mínima',    'number', '°C',   '[]'::jsonb,                              false, 'item',    2),
    (e2e.gid(p_org, '93000000-0000-0000-0000-000000000003'), p_org, e2e.gid(p_org, '92000000-0000-0000-0000-000000000004'), 'Temperatura máxima',    'number', '°C',   '[]'::jsonb,                              false, 'item',    3),
    (e2e.gid(p_org, '93000000-0000-0000-0000-000000000004'), p_org, e2e.gid(p_org, '92000000-0000-0000-0000-000000000004'), 'Velocidad recomendada', 'number', 'mm/s', '[]'::jsonb,                              false, 'item',    4),
    (e2e.gid(p_org, '93000000-0000-0000-0000-000000000005'), p_org, e2e.gid(p_org, '92000000-0000-0000-0000-000000000004'), 'Color',                 'list',   null,   '["Negro","Blanco","Rojo","Azul"]'::jsonb, true,  'variant', 5);

  insert into items (id, organization_id, business_line_id, kind, name, description, unit_id, category_id, min_stock, attributes) values
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000005'), p_org, e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'supply', 'PLA Sunlu', 'Rollo de 1 kg, 1,75 mm.', e2e.gid(p_org, '60000000-0000-0000-0000-000000000002'), e2e.gid(p_org, '92000000-0000-0000-0000-000000000004'), 1,
     jsonb_build_object(
       e2e.gid(p_org, '93000000-0000-0000-0000-000000000001')::text, 'Sunlu',
       e2e.gid(p_org, '93000000-0000-0000-0000-000000000002')::text, 190,
       e2e.gid(p_org, '93000000-0000-0000-0000-000000000003')::text, 220,
       e2e.gid(p_org, '93000000-0000-0000-0000-000000000004')::text, 60));

  insert into item_variants (id, organization_id, item_id, name, attributes) values
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000021'), p_org, e2e.gid(p_org, '90000000-0000-0000-0000-000000000005'), 'Negro',
     jsonb_build_object(e2e.gid(p_org, '93000000-0000-0000-0000-000000000005')::text, 'Negro')),
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000022'), p_org, e2e.gid(p_org, '90000000-0000-0000-0000-000000000005'), 'Rojo',
     jsonb_build_object(e2e.gid(p_org, '93000000-0000-0000-0000-000000000005')::text, 'Rojo'));

  -- ── Pedidos (KAM-07) ──────────────────────────────────────────────────────
  -- Hasta KAM-08 no hay pantalla de alta, así que el tablero y las pruebas
  -- viven de aquí. Se siembran a propósito los casos límite que los criterios
  -- exigen, y `seed_geeko.test.sql` verifica que sigan estando:
  --
  --   · tres en la columna En cola de Sublimación, con `queued_at` en orden
  --     INVERSO a `due_date` — así el criterio 6 ("numerados por llegada, no
  --     por fecha comprometida") solo pasa si el orden es el correcto;
  --   · uno vencido en un estado `waiting` (no debe alertar) y otro vencido en
  --     `in_progress` (sí debe alertar);
  --   · uno vencido en `final` (tampoco alerta) y uno sin fecha comprometida;
  --   · uno archivado, para el filtro "Ver archivados";
  --   · pedidos de Alfarería, para comprobar que sus tres columnas no arrastran
  --     ni rastro de las seis de Sublimación.
  --
  -- `code` y `queued_at` se fijan explícitamente: los triggers los respetan
  -- cuando vienen dados, y las pruebas necesitan valores estables.

  insert into orders (
    id, organization_id, business_line_id, kind, code, contact_id, status_id,
    sales_channel_id, delivery_mode, due_date, occurred_at, queued_at, notes
  ) values
    -- Los tres de la cola. Llega primero el #1, pero se compromete el último:
    -- si algún día el tablero ordenara por `due_date`, saldrían al revés.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000001'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 1,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000002'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000013'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'), 'pickup',
     current_date + 9, now() - interval '3 days', now() - interval '3 days',
     'Tazas para cumpleaños. Diseño enviado por WhatsApp.'),

    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000002'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 2,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000004'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000013'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'), 'delivery',
     current_date + 5, now() - interval '2 days', now() - interval '2 days',
     'Pedido del colegio. Confirmar cantidad exacta antes de imprimir.'),

    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000003'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 3,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000003'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000013'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000002'), 'pickup',
     current_date + 2, now() - interval '1 day', now() - interval '1 day',
     null),

    -- Vencido en `waiting` (Listo para entrega): NO alerta. Es el caso del
    -- criterio 4 — el trabajo está hecho, la espera es del cliente.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000004'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 4,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000002'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000015'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000004'), 'pickup',
     current_date - 4, now() - interval '12 days', null,
     'Avisado por teléfono, pasa a recoger esta semana.'),

    -- Vencido en `in_progress` (En diseño): SÍ alerta. Criterio 5.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000005'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 5,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000004'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000012'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'), 'delivery',
     current_date - 2, now() - interval '10 days', null,
     'Falta que aprueben el arte.'),

    -- Vencido en `final` (Entregado): tampoco alerta.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000006'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 6,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000003'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000016'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000002'), 'delivery',
     current_date - 7, now() - interval '20 days', null,
     null),

    -- Sin fecha comprometida: no alerta aunque esté en proceso.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000007'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 7,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000002'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000014'),
     null, null,
     null, now() - interval '5 days', null,
     'Sin fecha: la clienta dijo "cuando puedan".'),

    -- Alfarería: sus tres columnas, ninguna de Sublimación.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000011'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'order', 8,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000004'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000021'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'), 'pickup',
     current_date + 14, now() - interval '4 days', null,
     'Macetas para el patio del colegio.'),

    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000012'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'order', 9,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000002'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000022'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000001'), 'pickup',
     current_date + 1, now() - interval '6 days', null,
     null),

    -- Impresión 3D, en su propia cola.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000021'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'order', 10,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000003'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000032'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000002'), 'delivery',
     current_date + 6, now() - interval '2 days', now() - interval '2 days',
     'Repuesto impreso en PLA negro.');

  -- Archivado aparte: `enforce_archive_rules` congela la fila en cuanto
  -- `archived_at` deja de ser nulo, así que se inserta ya archivado.
  insert into orders (
    id, organization_id, business_line_id, kind, code, contact_id, status_id,
    sales_channel_id, delivery_mode, due_date, occurred_at, notes, archived_at
  ) values
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000031'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'order', 11,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000002'), e2e.gid(p_org, '70000000-0000-0000-0000-000000000017'),
     e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'), 'pickup',
     current_date - 30, now() - interval '40 days',
     'Cancelado por la clienta; se archiva para no ensuciar el tablero.',
     now() - interval '30 days');

  -- Líneas. El pedido #1 lleva dos para que su total sea comprobable
  -- (3 × 45 + 1 × 55 = 190) y el #7 ninguna, para el caso "pedido sin líneas,
  -- total 0 y no nulo".
  insert into order_items (id, organization_id, order_id, item_id, variant_id, description, quantity, unit_price) values
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000001'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), e2e.gid(p_org, '91000000-0000-0000-0000-000000000001'), 'Foto de la familia, fondo azul', 3, 45),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000002'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), e2e.gid(p_org, '91000000-0000-0000-0000-000000000002'), 'La grande, con el nombre',       1, 55),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000003'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000002'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), e2e.gid(p_org, '91000000-0000-0000-0000-000000000001'), 'Escudo del colegio',            30, 40),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000004'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000003'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), null,                                   null,                             2, 45),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000005'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000004'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), e2e.gid(p_org, '91000000-0000-0000-0000-000000000002'), null,                             6, 55),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000006'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000005'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), null,                                   'Arte pendiente de aprobación',  12, 45),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000007'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000006'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), null,                                   null,                             4, 45),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000011'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000011'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000012'), null,                                   'Cinco medianas, esmalte mate',   5, 60),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000012'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000012'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000012'), null,                                   null,                             2, 60),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000021'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000021'), null,                                   null,                                   'Pieza a medida según plano',     1, 120),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000031'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000031'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000011'), null,                                   null,                             2, 45);

  -- Imagen de referencia del pedido #1: la fila de `attachments` existe aunque
  -- el objeto no esté en el bucket. El detalle debe rendirla sin romperse, y
  -- es lo que ejercita `entity_type = 'order'` (KAM-08 trae la subida).
  insert into attachments (
    id, organization_id, entity_type, entity_id, bucket, storage_path,
    file_name, mime_type, size_bytes
  ) values
    (e2e.gid(p_org, 'a2000000-0000-0000-0000-000000000001'), p_org,
     'order', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000001'), 'attachments',
     p_org || '/order/' || e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000001') || '/referencia.jpg',
     'referencia.jpg', 'image/jpeg', 184320);

  -- ── Egresos (KAM-09) ──────────────────────────────────────────────────────
  -- Compras y gastos de Geeko Store para ejercitar V7, V8 y V9 y para que las
  -- pruebas tengan materia; `seed_geeko.test.sql` vigila que sigan estando:
  --
  --   · una compra con varias líneas, para el total derivado;
  --   · "Taza para sublimación" comprada DOS veces a precios distintos, con la
  --     más reciente por `occurred_at` (9.20) registrada ANTES que la otra
  --     (8.50, anotada tarde y fechada atrás) — así `item_last_cost` solo
  --     acierta si decide por la fecha del hecho y no por el orden de registro;
  --   · un gasto en la línea General, que queda sin repartir;
  --   · un gasto asignado a un pedido;
  --   · una compra archivada, que no cuenta ni para el total ni para el último
  --     costo.
  --
  -- `created_at` se fija explícitamente donde el orden de registro importa.
  -- Los egresos no llevan `created_by`: la semilla corre como `postgres`.

  insert into expenses (
    id, organization_id, business_line_id, kind, contact_id, expense_category_id,
    order_id, amount, occurred_at, created_at, note
  ) values
    -- Compra con dos líneas (50 × 8.50 + 2 × 95 = 615). Fechada hace 20 días
    -- pero registrada ayer: la taza a 8.50 NO es el último costo.
    (e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000001'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'purchase', e2e.gid(p_org, '80000000-0000-0000-0000-000000000001'),
     null, null, null, now() - interval '20 days', now() - interval '1 day',
     'Reposición de tazas y papel. Factura pendiente de archivar.'),

    -- La compra más reciente de la taza (9.20), registrada el mismo día.
    (e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000002'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'purchase', e2e.gid(p_org, '80000000-0000-0000-0000-000000000003'),
     null, null, null, now() - interval '3 days', now() - interval '3 days',
     null),

    -- Alfarería: arcilla.
    (e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000003'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'purchase', e2e.gid(p_org, '80000000-0000-0000-0000-000000000003'),
     null, null, null, now() - interval '8 days', now() - interval '8 days',
     'Cuatro sacos para la hornada 07.'),

    -- Gasto en General: no pertenece a ninguna línea concreta y se queda ahí
    -- para el reparto proporcional de los reportes (§6.1).
    (e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000004'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000004'), 'expense', null,
     e2e.gid(p_org, '50000000-0000-0000-0000-000000000002'), null, 120, now() - interval '6 days', now() - interval '6 days',
     'Internet del taller, mes en curso.'),

    -- Gasto asignado al pedido #1.
    (e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000005'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'expense', null,
     e2e.gid(p_org, '50000000-0000-0000-0000-000000000003'), e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000001'), 35,
     now() - interval '2 days', now() - interval '2 days',
     'Taxi para llevar las tazas del pedido #1.'),

    -- Impresión 3D: herramienta.
    (e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000006'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000002'), 'expense', null,
     e2e.gid(p_org, '50000000-0000-0000-0000-000000000004'), null, 260, now() - interval '12 days', now() - interval '12 days',
     'Boquillas de repuesto para la Ender.');

  -- Archivada aparte: `enforce_archive_rules` congela la fila en cuanto
  -- `archived_at` deja de ser nulo, así que se inserta ya archivada. Su taza a
  -- 7.90 no puede ser el último costo.
  insert into expenses (
    id, organization_id, business_line_id, kind, contact_id, occurred_at, created_at,
    note, archived_at
  ) values
    (e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000007'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'purchase', e2e.gid(p_org, '80000000-0000-0000-0000-000000000001'),
     now() - interval '45 days', now() - interval '45 days',
     'Registrada dos veces por error; se archiva la repetida.',
     now() - interval '40 days');

  insert into expense_items (id, organization_id, expense_id, item_id, variant_id, quantity, unit_price) values
    (e2e.gid(p_org, 'b1000000-0000-0000-0000-000000000001'), p_org, e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000001'), null, 50, 8.50),
    (e2e.gid(p_org, 'b1000000-0000-0000-0000-000000000002'), p_org, e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000001'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000002'), null,  2, 95),
    (e2e.gid(p_org, 'b1000000-0000-0000-0000-000000000003'), p_org, e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000002'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000001'), null, 30, 9.20),
    (e2e.gid(p_org, 'b1000000-0000-0000-0000-000000000004'), p_org, e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000003'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000003'), null,  4, 38),
    (e2e.gid(p_org, 'b1000000-0000-0000-0000-000000000007'), p_org, e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000007'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000001'), null, 20, 7.90);

  -- Comprobante del gasto de internet: la fila de `attachments` existe aunque el
  -- objeto no esté en el bucket, igual que la imagen de referencia del pedido
  -- #1. El detalle debe rendirla sin romperse.
  insert into attachments (
    id, organization_id, entity_type, entity_id, bucket, storage_path,
    file_name, mime_type, size_bytes
  ) values
    (e2e.gid(p_org, 'b2000000-0000-0000-0000-000000000001'), p_org,
     'expense', e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000004'), 'receipts',
     p_org || '/expense/' || e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000004') || '/factura-internet.jpg',
     'factura-internet.jpg', 'image/jpeg', 96512);

  -- ── Inventario (KAM-18) ───────────────────────────────────────────────────
  -- Las **entradas no se siembran**: las genera el trigger `record_stock_entry`
  -- al insertarse las líneas de compra de arriba. Sembrarlas a mano duplicaría
  -- cada una y escondería justo lo que hay que poder ver funcionando.
  --
  -- Estado que deja esta semilla, y por qué cada pieza:
  --
  --   Taza para sublimación  100 comprada − 40 consumida − 3 de ajuste =  57  (mínimo  12) → sano, con historial de los tres tipos
  --   Papel de transferencia                                    2 comprado  (mínimo 100) → bajo mínimo
  --   Arcilla roja                                              4 comprada  (mínimo  25) → bajo mínimo
  --   Caja de cartón                                            0           (mínimo  40) → bajo mínimo, y compartida entre líneas
  --
  -- Las 20 unidades de taza de la compra archivada `b0000000-…-07` **cuentan**:
  -- archivar una compra no toca el inventario (design D1, supuesto 3). Es el
  -- ejemplo vivo de esa regla dentro de la propia semilla.

  insert into inventory_movements (
    id, organization_id, item_id, kind, quantity, source_type, source_id,
    occurred_at, note
  ) values
    -- Consumos de una persona: siempre `manual`, aunque salgan de un pedido
    -- (design D5). La referencia al pedido vive en la nota, no en `source_id`.
    (e2e.gid(p_org, 'c3000000-0000-0000-0000-000000000001'), p_org,
     e2e.gid(p_org, '90000000-0000-0000-0000-000000000001'), 'out', -24, 'manual', null,
     now() - interval '20 days', 'Pedido #1'),
    (e2e.gid(p_org, 'c3000000-0000-0000-0000-000000000002'), p_org,
     e2e.gid(p_org, '90000000-0000-0000-0000-000000000001'), 'out', -16, 'manual', null,
     now() - interval '9 days', 'Feria de agosto'),

    -- Ajuste por conteo: se contaron 57 donde el saldo decía 60. Sin
    -- justificación, que es justamente el punto (criterio nº 4 del backlog).
    (e2e.gid(p_org, 'c3000000-0000-0000-0000-000000000003'), p_org,
     e2e.gid(p_org, '90000000-0000-0000-0000-000000000001'), 'adjustment', -3, 'count', null,
     now() - interval '2 days', null);

  -- ── Cobros y pagos (KAM-10) ───────────────────────────────────────────────
  -- Los casos que el bloque de cobros, la señal de pago de la tarjeta y los
  -- indicadores necesitan para tener materia; `seed_geeko.test.sql` vigila que
  -- sigan estando:
  --
  --   · el pedido #1 (total 190) con un anticipo de 60 → saldo 130, parcial;
  --   · el pedido #3 (total 90) saldado al céntimo → pagado;
  --   · el pedido #12 (total 120) con 150 cobrados → saldo −30, sobrepagado, y
  --     aportando CERO al indicador Por cobrar sin restarle a los demás;
  --   · el pedido #4 (total 330) con un cobro anulado y otro vigente → el
  --     anulado no cuenta y el saldo lo refleja;
  --   · el gasto de internet (120) pagado en parte → saldo por pagar 70.
  --
  -- Los movimientos no llevan `created_by`: la semilla corre como `postgres`.
  -- El anulado se inserta YA archivado: `enforce_archive_rules` congela la fila
  -- en cuanto `archived_at` deja de ser nulo, igual que en pedidos y egresos.

  insert into payments (
    id, organization_id, direction, order_id, amount, method, occurred_at, note
  ) values
    -- Anticipo del pedido #1: 60 de 190.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000001'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000001'), 60, 'cash',
     now() - interval '3 days', 'Adelanto al confirmar el diseño.'),

    -- Pedido #3 saldado: 90 de 90.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000002'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000003'), 90, 'transfer',
     now() - interval '1 day', 'Pagado completo al recoger.'),

    -- Pedido #12 sobrepagado: 150 sobre un total de 120. El saldo queda en −30
    -- y se ve; el indicador no lo compensa contra otros pedidos.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000003'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000012'), 150, 'cash',
     now() - interval '2 days', 'La clienta redondeó hacia arriba.'),

    -- Pedido #4: el cobro que sí cuenta.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000004'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000004'), 130, 'cash',
     now() - interval '4 days', null);

  insert into payments (
    id, organization_id, direction, expense_id, amount, method, occurred_at, note
  ) values
    -- Gasto de internet pagado en parte: 50 de 120.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000005'), p_org,
     'out', e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000004'), 50, 'transfer',
     now() - interval '5 days', 'Primera cuota del mes.');

  -- El cobro anulado del pedido #4: registrado por error y corregido por la vía
  -- prevista —anular y volver a registrar—, no editando el importe. Sigue
  -- visible en el detalle, tachado, y no cuenta en `paid`.
  insert into payments (
    id, organization_id, direction, order_id, amount, method, occurred_at, note,
    archived_at
  ) values
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000011'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000004'), 100, 'cash',
     now() - interval '5 days', 'Anotado en el pedido equivocado.',
     now() - interval '4 days');

  -- ── Activos (KAM-19) ──────────────────────────────────────────────────────
  -- Los dos ítems de tipo activo del catálogo, ahora con costo y fecha, en
  -- líneas distintas para que la pantalla muestre barras en estados distintos;
  -- `seed_geeko.test.sql` vigila que sigan estando:
  --
  --   · la prensa de tazas (Sublimación, 900, hace 8 meses) con el egreso de su
  --     compra vinculado como adquisición y un mantenimiento de 120 vinculado —
  --     su barra avanza y su costo total (1020) no es el declarado;
  --   · la impresora 3D (Impresión 3D, 1500, hace 2 meses) sin mantenimiento y
  --     en una línea que todavía no ha cobrado nada — su barra muestra 0 % sin
  --     errores, que es el otro estado que hay que poder ver funcionando.
  --
  -- La compra de la prensa y el mantenimiento se pagan: es lo que hace visible
  -- la regla de que la inversión cuenta una sola vez. Si esos pagos restaran
  -- del margen, las dos barras estarían en cero y la semilla no enseñaría nada.

  insert into asset_details (item_id, organization_id, acquisition_cost, acquired_on, supplier_id, notes) values
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000021'), p_org,
     900, (now() - interval '8 months')::date, e2e.gid(p_org, '80000000-0000-0000-0000-000000000001'),
     'Comprada con la primera tanda de tazas.'),
    (e2e.gid(p_org, '90000000-0000-0000-0000-000000000022'), p_org,
     1500, (now() - interval '2 months')::date, e2e.gid(p_org, '80000000-0000-0000-0000-000000000003'),
     null);

  -- La compra de la prensa: un egreso real, con su línea apuntando al activo.
  insert into expenses (
    id, organization_id, business_line_id, kind, contact_id, expense_category_id,
    order_id, amount, occurred_at, note, asset_id, asset_expense_role
  ) values
    (e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000011'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'purchase', e2e.gid(p_org, '80000000-0000-0000-0000-000000000001'),
     null, null, null, now() - interval '8 months', 'Prensa térmica de 6 tazas.',
     e2e.gid(p_org, '90000000-0000-0000-0000-000000000021'), 'acquisition'),

    -- Mantenimiento de la prensa: sube su costo total a 3480 sin bajar su margen.
    (e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000012'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000001'), 'expense', null,
     e2e.gid(p_org, '50000000-0000-0000-0000-000000000004'), null, 120, now() - interval '2 months',
     'Cambio de resistencia de la prensa.',
     e2e.gid(p_org, '90000000-0000-0000-0000-000000000021'), 'maintenance');

  insert into expense_items (organization_id, expense_id, item_id, quantity, unit_price) values
    (p_org, e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000011'),
     e2e.gid(p_org, '90000000-0000-0000-0000-000000000021'), 1, 900);

  insert into payments (
    id, organization_id, direction, expense_id, amount, method, occurred_at, note
  ) values
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000031'), p_org,
     'out', e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000011'), 900, 'transfer',
     now() - interval '8 months', null),
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000032'), p_org,
     'out', e2e.gid(p_org, 'b0000000-0000-0000-0000-000000000012'), 120, 'cash',
     now() - interval '2 months', null);

  -- ── Ventas directas de feria (KAM-12) ─────────────────────────────────────
  -- Alfarería vende casi todo así: sin pedido, sin ciclo de producción, cobrado
  -- en el acto. Nacen en el estado de tipo `final` de su línea («Entregado»,
  -- 70000000-…-0023), que es exactamente lo que hace `create_direct_sale`.
  --
  -- La semilla las inserta directamente y no por la función porque corre como
  -- `postgres`, sin sesión ni `auth.uid()`; el estado se escribe a mano, con el
  -- mismo criterio que la función aplica.
  --
  -- Sirven a tres cosas a la vez:
  --   · que la cuadrícula de más vendidos tenga orden observable —la taza de
  --     barro vende más que la maceta, y el plato hondo casi nada—;
  --   · que los ingresos de la línea sumen pedidos y ventas directas;
  --   · que el tablero de pedidos demuestre que NO las muestra.
  --
  -- El cliente es nulo en casi todas: en una feria nadie pregunta el nombre.

  insert into orders (
    id, organization_id, business_line_id, kind, code, contact_id, status_id,
    sales_channel_id, occurred_at, notes
  ) values
    -- Feria de hace tres días: cuatro ventas seguidas, sin cliente.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000041'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'direct_sale', 20, null,
     e2e.gid(p_org, '70000000-0000-0000-0000-000000000023'), e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'),
     now() - interval '3 days', null),
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000042'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'direct_sale', 21, null,
     e2e.gid(p_org, '70000000-0000-0000-0000-000000000023'), e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'),
     now() - interval '3 days', null),
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000043'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'direct_sale', 22, null,
     e2e.gid(p_org, '70000000-0000-0000-0000-000000000023'), e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'),
     now() - interval '3 days', null),
    -- Con cliente: alguien que pidió factura y quedó en el directorio.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000044'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'direct_sale', 23,
     e2e.gid(p_org, '80000000-0000-0000-0000-000000000004'),
     e2e.gid(p_org, '70000000-0000-0000-0000-000000000023'), e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'),
     now() - interval '3 days', 'Pidió comprobante.'),
    -- Cobrada solo en parte: se llevó las piezas y quedó a deber.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000045'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'direct_sale', 24, null,
     e2e.gid(p_org, '70000000-0000-0000-0000-000000000023'), e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'),
     now() - interval '2 days', 'Quedó debiendo 30.'),
    -- Sin cobro: el caso raro, no el imposible.
    (e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000046'), p_org,
     e2e.gid(p_org, '30000000-0000-0000-0000-000000000003'), 'direct_sale', 25, null,
     e2e.gid(p_org, '70000000-0000-0000-0000-000000000023'), e2e.gid(p_org, '40000000-0000-0000-0000-000000000003'),
     now() - interval '1 day', 'Se la llevó fiada; paga la próxima feria.');

  -- Líneas. Las cantidades están elegidas para que el orden de la cuadrícula sea
  -- comprobable: taza de barro 14, maceta 6, bolsa 4, plato hondo 1.
  insert into order_items (id, organization_id, order_id, item_id, variant_id, description, quantity, unit_price) values
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000041'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000041'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000013'), null, null,  6, 35),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000042'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000041'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000012'), null, null,  2, 60),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000043'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000042'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000013'), null, null,  4, 35),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000044'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000042'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000015'), null, null,  4,  5),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000045'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000043'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000013'), null, null,  3, 35),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000046'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000044'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000012'), null, null,  3, 60),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000047'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000044'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000014'), null, null,  1, 28),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000048'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000045'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000012'), null, null,  1, 60),
    (e2e.gid(p_org, 'a1000000-0000-0000-0000-000000000049'), p_org, e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000046'), e2e.gid(p_org, '90000000-0000-0000-0000-000000000013'), null, null,  1, 35);

  -- Los cobros: en el acto y por el total, salvo los dos casos preparados.
  insert into payments (
    id, organization_id, direction, order_id, amount, method, occurred_at, note
  ) values
    -- #20: 6 × 35 + 2 × 60 = 330.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000021'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000041'), 330, 'cash', now() - interval '3 days', null),
    -- #21: 4 × 35 + 4 × 5 = 160.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000022'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000042'), 160, 'cash', now() - interval '3 days', null),
    -- #22: 3 × 35 = 105.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000023'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000043'), 105, 'cash', now() - interval '3 days', null),
    -- #23: 3 × 60 + 1 × 28 = 208, por transferencia porque pidió comprobante.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000024'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000044'), 208, 'transfer', now() - interval '3 days', null),
    -- #24: total 60, cobrados 30. Saldo pendiente 30, visible en el detalle.
    (e2e.gid(p_org, 'c0000000-0000-0000-0000-000000000025'), p_org,
     'in', e2e.gid(p_org, 'a0000000-0000-0000-0000-000000000045'), 30, 'cash', now() - interval '2 days', 'La mitad ahora.');
end
$geeko$;

-- En un bloque `do`: el CLI envía la semilla en un solo lote y prepara cada
-- sentencia antes de ejecutar ninguna, así que un `select` suelto no vería el
-- esquema que se acaba de crear unas líneas más arriba.
do $$ begin perform e2e.seed_geeko('10000000-0000-0000-0000-000000000003'); end $$;

-- Una copia de Geeko Store para una prueba: organización nueva, con el mismo
-- nombre y los mismos nombres de miembros —las pruebas los leen en pantalla—,
-- y usuarios propios con la contraseña de siempre.
create function e2e.clone_geeko() returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
  v_org uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_assistant uuid := gen_random_uuid();
  v_tag text := substr(replace(v_org::text, '-', ''), 1, 12);
  v_owner_email text := 'geeko+' || v_tag || '@kamay.test';
  v_assistant_email text := 'ayudante+' || v_tag || '@kamay.test';
begin
  insert into organizations (id, name) values (v_org, 'Geeko Store');

  perform e2e.create_user(v_owner, v_owner_email);
  perform e2e.create_user(v_assistant, v_assistant_email);

  insert into memberships (organization_id, user_id, role, display_name) values
    (v_org, v_owner, 'owner', 'Dueña Geeko'),
    (v_org, v_assistant, 'assistant', 'Ayudante Geeko');

  perform e2e.seed_geeko(v_org);

  return jsonb_build_object(
    'organizationId', v_org,
    'owner', v_owner_email,
    'assistant', v_assistant_email
  );
end
$$;

revoke execute on all functions in schema e2e from public;

-- ── Doce meses de historia · Kamay Histórico (KAM-14) ─────────────────────
-- Todo lo sembrado hasta aquí ocurre en los últimos días: suficiente para el
-- tablero y el detalle, insuficiente para el panel, cuyo criterio de carga
-- —menos de 1,5 s con doce meses sembrados— no se podría medir sobre un solo
-- mes.
--
-- Esa profundidad vive en su propia organización y no en Geeko Store por una
-- razón comprobada: las filas de Geeko son fixtures de las suites de tablero,
-- alta de pedidos y modo feria. Treinta y seis pedidos más les cambian las
-- columnas, las listas y el orden de la cuadrícula de feria —que se ordena
-- por lo más vendido de los últimos 90 días—, y esas suites empiezan a fallar
-- por datos que no son suyos.
--
-- Dos cosas se siembran descuadradas a propósito, porque son justo lo que
-- distingue la lectura en caja de la devengada (design D1):
--
--   · el pedido de cada mes se registra en su mes pero **se cobra al mes
--     siguiente**, de modo que ingresos y facturación nunca coinciden;
--   · el gasto sí se paga en su propio mes, de modo que la diferencia entre
--     ambos criterios se ve en una sola columna.
-- Como Geeko, en una función: `e2e.clone_historico()` le da a cada prueba su
-- propio año de historia.
create function e2e.seed_historico(p_org uuid) returns void
language plpgsql set search_path = public, extensions as $historico$
begin
  insert into business_lines (id, organization_id, name, color, is_shared, position) values
    (e2e.gid(p_org, '31000000-0000-0000-0000-000000000001'), p_org, 'Sublimación',  'blue',   false, 1),
    (e2e.gid(p_org, '31000000-0000-0000-0000-000000000002'), p_org, 'Impresión 3D', 'violet', false, 2),
    (e2e.gid(p_org, '31000000-0000-0000-0000-000000000003'), p_org, 'Alfarería',    'orange', false, 3);

  insert into sales_channels (id, organization_id, name, position) values
    (e2e.gid(p_org, '41000000-0000-0000-0000-000000000001'), p_org, 'Feria', 1);

  insert into expense_categories (id, organization_id, name) values
    (e2e.gid(p_org, '51000000-0000-0000-0000-000000000001'), p_org, 'Insumos');

  insert into units (id, organization_id, code, name) values
    (e2e.gid(p_org, '61000000-0000-0000-0000-000000000001'), p_org, 'u', 'Unidad');

  -- Un estado por tipo y por línea: el histórico no ejercita ningún flujo, solo
  -- necesita que cada pedido tenga un estado válido de su propia línea.
  insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
    (e2e.gid(p_org, '71000000-0000-0000-0000-000000000011'), p_org, e2e.gid(p_org, '31000000-0000-0000-0000-000000000001'), 'order', 'Registrado', 'initial', 1),
    (e2e.gid(p_org, '71000000-0000-0000-0000-000000000012'), p_org, e2e.gid(p_org, '31000000-0000-0000-0000-000000000001'), 'order', 'Entregado',  'final',   2),
    (e2e.gid(p_org, '71000000-0000-0000-0000-000000000021'), p_org, e2e.gid(p_org, '31000000-0000-0000-0000-000000000002'), 'order', 'Registrado', 'initial', 1),
    (e2e.gid(p_org, '71000000-0000-0000-0000-000000000022'), p_org, e2e.gid(p_org, '31000000-0000-0000-0000-000000000002'), 'order', 'Entregado',  'final',   2),
    (e2e.gid(p_org, '71000000-0000-0000-0000-000000000031'), p_org, e2e.gid(p_org, '31000000-0000-0000-0000-000000000003'), 'order', 'Registrado', 'initial', 1),
    (e2e.gid(p_org, '71000000-0000-0000-0000-000000000032'), p_org, e2e.gid(p_org, '31000000-0000-0000-0000-000000000003'), 'order', 'Entregado',  'final',   2);

  insert into contacts (id, organization_id, name, is_customer, is_supplier) values
    (e2e.gid(p_org, '81000000-0000-0000-0000-000000000001'), p_org, 'Clientela del año', true,  false),
    (e2e.gid(p_org, '81000000-0000-0000-0000-000000000002'), p_org, 'Proveedor del año', false, true);

  insert into items (id, organization_id, business_line_id, kind, name, unit_id, sale_price) values
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000001'), p_org, e2e.gid(p_org, '31000000-0000-0000-0000-000000000001'), 'product', 'Taza estampada', e2e.gid(p_org, '61000000-0000-0000-0000-000000000001'), 45),
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000002'), p_org, e2e.gid(p_org, '31000000-0000-0000-0000-000000000002'), 'product', 'Llavero 3D',     e2e.gid(p_org, '61000000-0000-0000-0000-000000000001'), 60),
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000003'), p_org, e2e.gid(p_org, '31000000-0000-0000-0000-000000000003'), 'product', 'Taza de barro',  e2e.gid(p_org, '61000000-0000-0000-0000-000000000001'), 35);

  -- Un pedido entregado por línea y por mes, de hace 1 a 12 meses. Las
  -- cantidades varían con el mes para que el comparativo no salga plano.
  insert into orders (
    id, organization_id, business_line_id, kind, code, contact_id, status_id,
    sales_channel_id, delivery_mode, due_date, occurred_at
  )
  select
    e2e.gid(p_org, ('a2000000-0000-0000-0000-0000000' || lpad((mes * 10 + linea.idx)::text, 5, '0'))::uuid),
    p_org,
    linea.id,
    'order',
    mes * 10 + linea.idx,
    e2e.gid(p_org, '81000000-0000-0000-0000-000000000001'),
    linea.final_status,
    e2e.gid(p_org, '41000000-0000-0000-0000-000000000001'),
    case when mes % 2 = 0 then 'delivery' else 'pickup' end,
    (current_date - (mes * 30))::date,
    now() - (mes * interval '30 days')
  from generate_series(1, 12) as mes
  cross join (values
    (e2e.gid(p_org, '31000000-0000-0000-0000-000000000001')::uuid, e2e.gid(p_org, '71000000-0000-0000-0000-000000000012')::uuid, 1),
    (e2e.gid(p_org, '31000000-0000-0000-0000-000000000002')::uuid, e2e.gid(p_org, '71000000-0000-0000-0000-000000000022')::uuid, 2),
    (e2e.gid(p_org, '31000000-0000-0000-0000-000000000003')::uuid, e2e.gid(p_org, '71000000-0000-0000-0000-000000000032')::uuid, 3)
  ) as linea(id, final_status, idx);

  insert into order_items (
    id, organization_id, order_id, item_id, quantity, unit_price
  )
  select
    e2e.gid(p_org, ('a3000000-0000-0000-0000-0000000' || lpad((mes * 10 + linea.idx)::text, 5, '0'))::uuid),
    p_org,
    e2e.gid(p_org, ('a2000000-0000-0000-0000-0000000' || lpad((mes * 10 + linea.idx)::text, 5, '0'))::uuid),
    linea.item_id,
    2 + ((mes + linea.idx) % 6),
    linea.price
  from generate_series(1, 12) as mes
  cross join (values
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000001')::uuid, 45.00, 1),
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000002')::uuid, 60.00, 2),
    (e2e.gid(p_org, '91000000-0000-0000-0000-000000000003')::uuid, 35.00, 3)
  ) as linea(item_id, price, idx);

  -- El cobro llega un mes después del pedido: en caja cuenta en el mes en que
  -- entró el dinero, no en el que se firmó el compromiso.
  insert into payments (
    id, organization_id, direction, order_id, amount, method, occurred_at
  )
  select
    e2e.gid(p_org, ('c2000000-0000-0000-0000-0000000' || lpad((mes * 10 + linea.idx)::text, 5, '0'))::uuid),
    p_org,
    'in',
    e2e.gid(p_org, ('a2000000-0000-0000-0000-0000000' || lpad((mes * 10 + linea.idx)::text, 5, '0'))::uuid),
    (2 + ((mes + linea.idx) % 6)) * linea.price,
    case when mes % 3 = 0 then 'transfer' else 'cash' end,
    now() - (mes * interval '30 days') + interval '30 days'
  from generate_series(1, 12) as mes
  cross join (values (45.00, 1), (60.00, 2), (35.00, 3)) as linea(price, idx);

  insert into expenses (
    id, organization_id, business_line_id, kind, contact_id, expense_category_id,
    amount, occurred_at, note
  )
  select
    e2e.gid(p_org, ('b2000000-0000-0000-0000-0000000' || lpad((mes * 10 + linea.idx)::text, 5, '0'))::uuid),
    p_org,
    linea.id,
    'expense',
    e2e.gid(p_org, '81000000-0000-0000-0000-000000000002'),
    e2e.gid(p_org, '51000000-0000-0000-0000-000000000001'),
    80 + ((mes * 7 + linea.idx * 13) % 120),
    now() - (mes * interval '30 days') + interval '2 days',
    'Insumos del mes.'
  from generate_series(1, 12) as mes
  cross join (values
    (e2e.gid(p_org, '31000000-0000-0000-0000-000000000001')::uuid, 1),
    (e2e.gid(p_org, '31000000-0000-0000-0000-000000000002')::uuid, 2),
    (e2e.gid(p_org, '31000000-0000-0000-0000-000000000003')::uuid, 3)
  ) as linea(id, idx);

  -- El gasto sí se paga en su propio mes.
  insert into payments (
    id, organization_id, direction, expense_id, amount, method, occurred_at
  )
  select
    e2e.gid(p_org, ('c3000000-0000-0000-0000-0000000' || lpad((mes * 10 + linea.idx)::text, 5, '0'))::uuid),
    p_org,
    'out',
    e2e.gid(p_org, ('b2000000-0000-0000-0000-0000000' || lpad((mes * 10 + linea.idx)::text, 5, '0'))::uuid),
    80 + ((mes * 7 + linea.idx * 13) % 120),
    'transfer',
    now() - (mes * interval '30 days') + interval '3 days'
  from generate_series(1, 12) as mes
  cross join (values (1), (2), (3)) as linea(idx);
end
$historico$;

do $$ begin perform e2e.seed_historico('10000000-0000-0000-0000-000000000004'); end $$;

create function e2e.clone_historico() returns jsonb
language plpgsql set search_path = public, extensions as $$
declare
  v_org uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_owner_email text := 'historico+' || substr(replace(v_org::text, '-', ''), 1, 12) || '@kamay.test';
begin
  insert into organizations (id, name) values (v_org, 'Kamay Histórico');
  perform e2e.create_user(v_owner, v_owner_email);
  insert into memberships (organization_id, user_id, role, display_name)
    values (v_org, v_owner, 'owner', 'Dueño Histórico');
  perform e2e.seed_historico(v_org);
  return jsonb_build_object('organizationId', v_org, 'owner', v_owner_email);
end
$$;

revoke execute on all functions in schema e2e from public;
