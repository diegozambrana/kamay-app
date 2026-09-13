-- KAM-23 · La exportación completa queda en la bitácora (spec `data-export`
-- → *Exporting is recorded in the activity log*; especificación §8, que
-- enumera las exportaciones entre los hechos que se registran).
--
-- La bitácora solo aprendía de los disparadores: cada fila que se crea, se
-- edita, cambia de estado o se archiva deja su evento. Una exportación no
-- toca ninguna fila, así que ningún disparador la ve. Hacen falta dos cosas:
--
--   · **La acción `exported`** en la lista que admite `activity_log`.
--   · **Una función que la registre**, porque `activity_log` es inmutable para
--     `authenticated` —ni insertar, ni editar, ni borrar—, y así sigue. La
--     función corre con privilegio propio (`security definer`) para poder
--     escribir, y a cambio hace una sola cosa: registra que la persona que la
--     llama exportó los datos de una organización a la que pertenece. No
--     admite autor, fecha ni acción elegidos por quien llama.

alter table activity_log drop constraint activity_log_action_check;

alter table activity_log add constraint activity_log_action_check
  check (action = any (array[
    'created', 'updated', 'status_changed', 'archived', 'unarchived', 'exported'
  ]));

create function record_export(p_organization uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo quien pertenece a la organización, y siempre a su nombre.
  if auth.uid() is null or not is_member(p_organization) then
    raise exception 'No perteneces a esta organización.'
      using errcode = '42501';
  end if;

  insert into activity_log (organization_id, actor_id, table_name, record_id, action, origin)
  values (
    p_organization,
    auth.uid(),
    'organizations',
    p_organization,
    'exported',
    nullif(current_setting('request.headers', true), '')::json->>'x-client-origin'
  );
end;
$$;

revoke execute on function record_export(uuid) from public, anon;
grant execute on function record_export(uuid) to authenticated;
