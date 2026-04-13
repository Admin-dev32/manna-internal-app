-- AUTH ↔ PROFILE sync hardening.
-- Objetivo: mejorar resiliencia cuando exista auth.users sin public.profiles
-- sin romper el modelo actual (auth.users identidad + profiles representación interna).

create or replace function public.reconcile_current_user_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  current_auth_uid uuid := auth.uid();
begin
  if current_auth_uid is null then
    return null;
  end if;

  select *
  into profile_row
  from public.profiles
  where id = current_auth_uid;

  if found then
    return profile_row;
  end if;

  -- Reconciliación controlada: solo para el propio usuario autenticado actual.
  -- Reutiliza la misma lógica validada por triggers (sync_profile_from_auth_user).
  return public.sync_profile_from_auth_user(current_auth_uid);
exception
  when others then
    -- No abrir acceso por error silencioso: devolvemos null para que login/guards mantengan bloqueo seguro.
    raise warning 'reconcile_current_user_profile falló para uid=%: %', current_auth_uid, sqlerrm;
    return null;
end;
$$;

grant execute on function public.reconcile_current_user_profile() to authenticated;
