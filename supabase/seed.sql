-- Semilla de desarrollo y pruebas (solo entorno local).
-- Usuarios: contraseña "kamay123" para todos.
--   owner@kamay.test    → dueño de "Taller Kamay" (una sola organización)
--   multi@kamay.test    → dueño de "Taller Kamay" y "Kamay Feria" (dos organizaciones)
--   recovery@kamay.test → ayudante de "Taller Kamay" (para la prueba de recuperación)

--   geeko@kamay.test    → dueña de "Geeko Store" (la organización real, con su configuración)

-- Organizaciones
insert into organizations (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Taller Kamay'),
  ('10000000-0000-0000-0000-000000000002', 'Kamay Feria'),
  ('10000000-0000-0000-0000-000000000003', 'Geeko Store');

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
  ('20000000-0000-0000-0000-000000000005'::uuid, 'ayudante@kamay.test')
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
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', 'assistant', 'Ayudante Geeko');

-- ── Geeko Store: la configuración real del negocio ────────────────────────
-- Tres líneas productivas más General/Compartido, que es donde caen los
-- registros que no pertenecen a una sola línea (esquema §18, semilla).

insert into business_lines (id, organization_id, name, color, is_shared, position) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Sublimación',  'blue',   false, 1),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Impresión 3D', 'violet', false, 2),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Alfarería',    'orange', false, 3),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'General',      'zinc',   true,  4);

insert into sales_channels (id, organization_id, name, position) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Feria',          1),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Redes',          2),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Pedido directo', 3),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'Mostrador',      4);

-- Juego mínimo para poder registrar egresos e ítems desde el primer día.
insert into expense_categories (id, organization_id, name) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Insumos'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Servicios'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Transporte'),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'Herramientas');

insert into units (id, organization_id, code, name) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'u',  'Unidad'),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'kg', 'Kilogramo'),
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'm',  'Metro'),
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'l',  'Litro');

-- ── Estados (KAM-05, esquema § Semilla) ───────────────────────────────────
-- Tareas: un solo juego de organización sirve a las tres líneas.
-- Pedidos: cada línea productiva trae el suyo; no hay juego de organización.

insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', null, 'task', 'Por hacer',   'initial',     1),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', null, 'task', 'Haciendo',    'in_progress', 2),
  ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', null, 'task', 'En revisión', 'waiting',     3),
  ('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', null, 'task', 'Hecho',       'final',       4);

-- Sublimación: los seis definidos, más Cancelado. "En cola" es la única
-- columna con is_queue: se ordena por antigüedad, no por urgencia.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, is_queue, position) values
  ('70000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'order', 'Registrado',         'initial',     false, 1),
  ('70000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'order', 'En diseño',          'in_progress', false, 2),
  ('70000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'order', 'En cola',            'waiting',     true,  3),
  ('70000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'order', 'Sublimando',         'in_progress', false, 4),
  ('70000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'order', 'Listo para entrega', 'waiting',     false, 5),
  ('70000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'order', 'Entregado',          'final',       false, 6),
  ('70000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'order', 'Cancelado',          'cancelled',   false, 7);

-- Alfarería: juego mínimo, casi todo se vende como venta directa.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, position) values
  ('70000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'order', 'Reservado',          'initial',   1),
  ('70000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'order', 'Listo para entrega', 'waiting',   2),
  ('70000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'order', 'Entregado',          'final',     3),
  ('70000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'order', 'Cancelado',          'cancelled', 4);

-- Impresión 3D: juego provisional (sublimación sin diseño), a confirmar con
-- los primeros 10 encargos reales.
insert into statuses (id, organization_id, business_line_id, flow, name, kind, is_queue, position) values
  ('70000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'order', 'Registrado',         'initial',     false, 1),
  ('70000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'order', 'En cola',            'waiting',     true,  2),
  ('70000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'order', 'Imprimiendo',        'in_progress', false, 3),
  ('70000000-0000-0000-0000-000000000034', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'order', 'Post-proceso',       'in_progress', false, 4),
  ('70000000-0000-0000-0000-000000000035', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'order', 'Listo para entrega', 'waiting',     false, 5),
  ('70000000-0000-0000-0000-000000000036', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'order', 'Entregado',          'final',       false, 6),
  ('70000000-0000-0000-0000-000000000037', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'order', 'Cancelado',          'cancelled',   false, 7);
