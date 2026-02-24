-- USN-based login role resolution
-- Run this after supabase/student-registry.sql

alter table public.users
add column if not exists usn text;

alter table public.users
add column if not exists is_suspended boolean not null default false;

create unique index if not exists users_usn_unique_normalized_idx
on public.users ((upper(btrim(usn))))
where usn is not null and btrim(usn) <> '';

create or replace function public.normalize_users_usn_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.usn is not null then
    new.usn := upper(btrim(new.usn));
    if new.usn = '' then
      new.usn := null;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.usn is not null
     and new.usn is distinct from old.usn then
    raise exception 'USN is already linked to this account and cannot be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_users_normalize_usn on public.users;
create trigger on_users_normalize_usn
before insert or update of usn on public.users
for each row execute procedure public.normalize_users_usn_row();

create or replace function public.resolve_user_role_by_usn(input_usn text)
returns table (
  role public.app_role,
  usn text,
  profile_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_usn text;
  existing_role public.app_role;
  existing_usn text;
  existing_name text;
  existing_is_suspended boolean;
  matched_first_name text;
  matched_last_name text;
  usn_owner_id uuid;
  resolved_role public.app_role;
  resolved_name text;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  normalized_usn := upper(btrim(coalesce(input_usn, '')));
  if normalized_usn = '' then
    raise exception 'USN is required.';
  end if;

  if to_regclass('public.student_registry') is null then
    raise exception 'student_registry table is missing. Run supabase/student-registry.sql first.';
  end if;

  insert into public.users (id, name, email, role, avatar_url)
  values (
    current_user_id,
    coalesce(
      nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
      split_part(coalesce(nullif(auth.jwt() ->> 'email', ''), current_user_id::text || '@local.invalid'), '@', 1),
      'Campus User'
    ),
    coalesce(nullif(auth.jwt() ->> 'email', ''), current_user_id::text || '@local.invalid'),
    'visitor'::public.app_role,
    '/avatar-default.svg'
  )
  on conflict (id) do nothing;

  select u.role, u.usn, u.name, u.is_suspended
  into existing_role, existing_usn, existing_name, existing_is_suspended
  from public.users u
  where u.id = current_user_id
  for update;

  if existing_usn is not null and upper(btrim(existing_usn)) <> normalized_usn then
    raise exception 'This account is already linked to USN % and cannot be changed.', existing_usn;
  end if;

  select u.id
  into usn_owner_id
  from public.users u
  where u.usn is not null
    and upper(btrim(u.usn)) = normalized_usn
    and u.id <> current_user_id
  limit 1;

  if usn_owner_id is not null then
    raise exception 'This USN is already linked to another account.';
  end if;

  select sr.first_name, sr.last_name
  into matched_first_name, matched_last_name
  from public.student_registry sr
  where upper(btrim(sr.usn)) = normalized_usn
    and sr.status = 'active'
  limit 1;

  if found then
    resolved_role := case
      when existing_role = 'admin' then 'admin'::public.app_role
      when existing_is_suspended then existing_role
      else 'member'::public.app_role
    end;
    resolved_name := btrim(concat_ws(' ', matched_first_name, matched_last_name));

    update public.users
    set role = resolved_role,
        usn = coalesce(existing_usn, normalized_usn),
        name = case
          when resolved_name <> '' then resolved_name
          else name
        end
    where id = current_user_id;

    role := resolved_role;
    usn := coalesce(existing_usn, normalized_usn);
    profile_name := case
      when resolved_name <> '' then resolved_name
      else existing_name
    end;
    return next;
    return;
  end if;

  resolved_role := case
    when existing_role = 'admin' then 'admin'::public.app_role
    when existing_is_suspended then existing_role
    else 'visitor'::public.app_role
  end;

  update public.users
  set role = resolved_role
  where id = current_user_id;

  role := resolved_role;
  usn := existing_usn;
  profile_name := existing_name;
  return next;
  return;
end;
$$;

grant execute on function public.resolve_user_role_by_usn(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      'Campus User'
    ),
    new.email,
    case
      when new.raw_user_meta_data ->> 'role' = 'admin' then 'admin'::public.app_role
      else 'visitor'::public.app_role
    end,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', ''),
      '/avatar-default.svg'
    )
  )
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email,
      role = case
        when public.users.role = 'admin' then public.users.role
        else excluded.role
      end,
      avatar_url = case
        when public.users.avatar_url is null
          or btrim(public.users.avatar_url) = ''
          or public.users.avatar_url = '/avatar-default.svg'
          then excluded.avatar_url
        else public.users.avatar_url
      end;

  return new;
end;
$$;
