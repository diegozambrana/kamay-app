-- KAM-23 · Solo una invitación vigente crea una cuenta (spec
-- `production-operations` → *Only a pending invitation can create an
-- account*; design D8; decisión del usuario, supuesto 11 de la propuesta).
--
-- ── El problema ───────────────────────────────────────────────────────────
-- Kamay no tiene registro público: las cuentas se crean por invitación
-- (KAM-02). Hasta aquí eso vivía en dos sitios que se contradecían:
--
--   · La pantalla no ofrece registrarse, pero la API de Auth sí aceptaba a
--     cualquiera cuando el alta estaba abierta.
--   · Con el alta cerrada en `config.toml` —como estaba—, la API rechaza a
--     todo el mundo, **incluida la persona invitada**: `signUpAndAccept`
--     (`actions/members.ts`) llama a `auth.signUp()` desde su sesión y recibía
--     `signup_disabled`. Una invitación a alguien sin cuenta no se podía
--     aceptar.
--
-- ── La salida ─────────────────────────────────────────────────────────────
-- Un hook *before user created*: Auth lo consulta antes de crear cualquier
-- usuario, y la función deja pasar solo el correo que tiene una invitación
-- vigente —ni aceptada, ni vencida, ni archivada— en alguna organización.
-- Con él, el alta del proveedor se abre sin que el registro sea público.
--
-- Se descartó crear la cuenta con la API de administración desde la acción:
-- pondría la clave de servicio en una acción disparada por el usuario, que la
-- convención nº 2 prohíbe.
--
-- La función corre como `supabase_auth_admin` —el rol que usa Auth para
-- llamarla— y lee `invitations` con privilegio propio (`security definer`,
-- `search_path` vacío y nombres calificados). Solo `supabase_auth_admin`
-- puede ejecutarla: ni `anon` ni `authenticated` la ven, así que no es una
-- forma de preguntar qué correos tienen invitación.

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(event -> 'user' ->> 'email'));
begin
  if v_email is not null and exists (
    select 1
      from public.invitations i
     where lower(i.email) = v_email
       and i.accepted_at is null
       and i.archived_at is null
       and i.expires_at > now()
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Kamay no tiene registro público: pide a la persona dueña de tu taller que te invite.'
    )
  );
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
