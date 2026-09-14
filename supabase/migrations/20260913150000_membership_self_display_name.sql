-- KAM-24 · Cada persona corrige su propio nombre visible sin depender del dueño.
-- No se abre una política `update` para la propia fila: eso también habilitaría
-- `role` y `archived_at` (escalada de privilegios). En vez de eso, una función
-- `security definer` que solo puede tocar `display_name`, y solo de `auth.uid()`.

create or replace function set_my_display_name(p_organization_id uuid, p_display_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update memberships
    set display_name = p_display_name
  where organization_id = p_organization_id
    and user_id = auth.uid()
    and archived_at is null;

  if not found then
    raise exception 'No se encontró tu membresía activa en esa organización'
      using errcode = 'check_violation';
  end if;
end $$;

-- Ni el rol anónimo ni el service role la necesitan: es autoservicio de la
-- propia sesión, y el service role nunca actúa en nombre de un usuario.
grant execute on function set_my_display_name(uuid, text) to authenticated;
revoke execute on function set_my_display_name(uuid, text) from anon, service_role;
