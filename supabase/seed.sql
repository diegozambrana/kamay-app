-- Semilla de desarrollo y pruebas (solo entorno local).
-- Usuarios: contraseña "kamay123" para todos.
--   owner@kamay.test    → dueño de "Taller Kamay" (una sola organización)
--   multi@kamay.test    → dueño de "Taller Kamay" y "Kamay Feria" (dos organizaciones)
--   recovery@kamay.test → ayudante de "Taller Kamay" (para la prueba de recuperación)

-- Organizaciones
insert into organizations (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Taller Kamay'),
  ('10000000-0000-0000-0000-000000000002', 'Kamay Feria');

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
  ('20000000-0000-0000-0000-000000000003'::uuid, 'recovery@kamay.test')
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
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'assistant', 'Ayudante Recuperación');
